import { NextResponse } from "next/server";
import { setAdminSession, validBootstrapAdmin } from "@/lib/auth";
import { DUMMY_PASSWORD_HASH, hashPassword, validateUsername, verifyPassword } from "@/lib/password";
import { supabaseApi } from "@/lib/supabase";
import { clearLoginFailures, isLoginLocked, recordLoginFailure, type LoginSecurity } from "@/lib/login-security";

type Account = LoginSecurity & { id: string; username: string; password_hash: string; player_id: string | null; role: "owner" | "admin" | "sponsor"; active: boolean; session_version: number };

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json() as { username?: string; password?: string };
    const cleanUsername = username?.trim() ?? "";
    if (!cleanUsername || !password) return NextResponse.json({ error: "Informe usuário e senha." }, { status: 400 });
    validateUsername(cleanUsername);
    if (password.length > 128) return NextResponse.json({ error: "Usuário ou senha incorretos." }, { status: 401 });

    const admins = await supabaseApi<Account[]>("/rest/v1/accounts?select=*&role=in.(owner,admin,sponsor)&limit=1");
    let account: Account;
    if (!admins.length) {
      if (!validBootstrapAdmin(cleanUsername, password)) return NextResponse.json({ error: "Usuário ou senha incorretos." }, { status: 401 });
      const created = await supabaseApi<Account[]>("/rest/v1/accounts", { method: "POST", prefer: "return=representation", body: JSON.stringify({ username: cleanUsername, password_hash: await hashPassword(password), role: "owner", active: true }) });
      account = created[0];
    } else {
      const matches = await supabaseApi<Account[]>("/rest/v1/rpc/get_account_for_auth", { method: "POST", body: JSON.stringify({ p_username: cleanUsername }) });
      account = matches[0];
      if (!account) {
        await verifyPassword(password, DUMMY_PASSWORD_HASH);
        return NextResponse.json({ error: "Usuário ou senha incorretos." }, { status: 401 });
      }
      if (isLoginLocked(account)) return NextResponse.json({ error: "Muitas tentativas. Aguarde 15 minutos antes de tentar novamente." }, { status: 429 });
      const passwordMatches = await verifyPassword(password, account.password_hash);
      if (!["owner", "admin", "sponsor"].includes(account.role) || !account.active || !passwordMatches) {
        if (account.active && ["owner", "admin", "sponsor"].includes(account.role)) {
          const result = await recordLoginFailure(account.id);
          if (result.locked) return NextResponse.json({ error: "Muitas tentativas. Aguarde 15 minutos antes de tentar novamente." }, { status: 429 });
        }
        return NextResponse.json({ error: "Usuário ou senha incorretos." }, { status: 401 });
      }
      await clearLoginFailures(account.id);
    }
    await setAdminSession({ id: account.id, username: account.username, playerId: account.player_id, role: account.role, sessionVersion: account.session_version });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível entrar." }, { status: 400 });
  }
}
