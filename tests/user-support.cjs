const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const targetId = '00000000-0000-4000-8000-000000000002';
let actor, target, updates, sessionRefreshes;
function reset(role = 'admin', targetRole = 'member') {
  actor = role ? { id: '00000000-0000-4000-8000-000000000001', username: 'support', role } : null;
  target = { id: targetId, username: 'player', player_id: '123', phone: null, role: targetRole, active: true, session_version: 4 };
  updates = []; sessionRefreshes = [];
}
const mocks = {
  'next/server': { NextResponse: { json: (body, options = {}) => ({ status: options.status || 200, body }) } },
  '@/lib/admin': { getActiveAdmin: async () => actor },
  '@/lib/auth': { setAdminSession: async value => sessionRefreshes.push(value) },
  '@/lib/supabase': { supabaseApi: async (url, options = {}) => {
    if (options.method === 'PATCH') { const changes = JSON.parse(options.body); updates.push(changes); return [{ ...target, ...changes }]; }
    if (options.method) throw Error('Unexpected mutation');
    return [target];
  } },
};
function load(file) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const requireLocal = name => mocks[name] || (name.startsWith('@/') ? load(name.slice(2) + '.ts') : require(name));
  vm.runInNewContext(source, { exports, require: requireLocal, Buffer, console }, { filename: file });
  return exports;
}
const item = load('app/api/admin/users/[id]/route.ts');
const list = load('app/api/admin/users/route.ts');
const context = { params: Promise.resolve({ id: targetId }) };
const patch = body => item.PATCH({ json: async () => body }, context);
(async () => {
  let checks = 0;
  for (const role of [null, 'sponsor', 'member']) {
    reset(role); assert.equal((await list.GET()).status, role ? 403 : 401);
    assert.equal((await patch({ username: 'changed' })).status, role ? 403 : 401); assert.equal(updates.length, 0); checks++;
  }
  reset(); assert.equal((await list.GET()).status, 200); checks++;
  for (const body of [{ role: 'owner' }, { role: 'admin' }, { active: false }]) {
    reset(); assert.equal((await patch(body)).status, 403); assert.equal(updates.length, 0); checks++;
  }
  reset('admin', 'owner'); assert.equal((await patch({ password: 'example-password-123' })).status, 403); assert.equal(updates.length, 0); checks++;
  reset(); let result = await patch({ username: 'newplayer', playerId: '456', password: 'example-password-123', recoveryCode: 'example-recovery-123' });
  assert.equal(result.status, 200); assert.equal(updates[0].role, 'member'); assert.equal(updates[0].session_version, 5);
  assert.ok(updates[0].password_hash.startsWith('scrypt:')); assert.ok(updates[0].recovery_code_hash.startsWith('scrypt:'));
  assert.equal(JSON.stringify(result).includes('example-'), false); checks++;
  reset(); assert.equal((await patch({ password: '', recoveryCode: '' })).status, 200); assert.equal(updates[0].password_hash, undefined); assert.equal(updates[0].recovery_code_hash, undefined); checks++;
  reset(); assert.equal((await patch({ recoveryCode: 'new-recovery-123' })).status, 200); assert.equal(updates[0].session_version, 5); checks++;
  for (const role of ['owner', 'admin', 'sponsor', 'member']) {
    reset('owner'); assert.equal((await patch({ role })).status, 200); assert.equal(updates[0].role, role); checks++;
  }
  reset('owner'); actor.id = targetId; actor.role = target.role = 'owner'; assert.equal((await patch({ role: 'member' })).status, 400); checks++;
  reset(); actor.id = targetId; target.role = 'admin'; assert.equal((await patch({ password: 'example-password-123' })).status, 200); assert.equal(sessionRefreshes[0].sessionVersion, 5); checks++;
  reset(); assert.equal((await list.POST({ json: async () => ({}) })).status, 403); assert.equal((await item.DELETE({}, context)).status, 403); checks++;
  reset(); assert.equal((await patch({ password: 'short' })).status, 409); assert.equal(updates.length, 0); checks++;
  console.log(`${checks} verificações de suporte aprovadas (banco simulado).`);
})().catch(error => { console.error(error); process.exitCode = 1; });
