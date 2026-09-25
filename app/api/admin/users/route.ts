import { NextResponse } from "next/server";
import { getActiveAdmin } from "@/lib/admin";
import { hashPassword, validatePassword, validateRecoveryCode, validateUsername } from "@/lib/password";
import { supabaseApi } from "@/lib/supabase";
import { validatePlayerId, validatePlayerPhone } from "@/lib/validation";

type AccountRow = {
  id: string;
  username: string;
  player_id: string | null;
  phone: string | null;
  role: "owner" | "admin" | "sponsor" | "member";
  active: boolean;
  created_at: string;
  session_version: number;
};

function publicAccount(account: AccountRow) {
  return {
    id: account.id,
    username: account.username,
    playerId: account.player_id,
    phone: account.phone,
    role: account.role,
    active: account.active,
    createdAt: account.created_at,
  };
}

const rolePriority: Record<AccountRow["role"], number> = {
  owner: 0,
  admin: 1,
  sponsor: 2,
  member: 3,
};

export async function GET() {
  const session = await getActiveAdmin();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (session.role !== "owner" && session.role !== "admin") return NextResponse.json({ error: "Somente Dono e Gerente podem acessar os usuários." }, { status: 403 });
  try {
    const accounts = await supabaseApi<AccountRow[]>("/rest/v1/accounts?select=id,username,player_id,phone,role,active,created_at");
    accounts.sort((left, right) => rolePriority[left.role] - rolePriority[right.role] || left.username.localeCompare(right.username, "pt-BR"));
    return NextResponse.json({ users: accounts.map(publicAccount) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao carregar usuários." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getActiveAdmin();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (session.role !== "owner") return NextResponse.json({ error: "Somente o Dono pode criar usuários pelo painel." }, { status: 403 });
  try {
    const body = await request.json() as { username?: string; password?: string; playerId?: string; phone?: string; recoveryCode?: string; role?: "owner" | "admin" | "sponsor" | "member" };
    const username = body.username?.trim() ?? "";
    const password = body.password ?? "";
    const playerId = validatePlayerId(body.playerId ?? "");
    const phone = validatePlayerPhone(body.phone ?? "");
    const recoveryCode = body.recoveryCode ?? "";
    const allowedRoles = ["owner", "admin", "sponsor", "member"] as const;
    const requestedRole = body.role;
    const role: AccountRow["role"] = requestedRole && allowedRoles.includes(requestedRole) ? requestedRole : "member";
    validateUsername(username);
    validatePassword(password);
    validateRecoveryCode(recoveryCode);
    const [passwordHash, recoveryCodeHash] = await Promise.all([hashPassword(password), hashPassword(recoveryCode)]);
    const created = await supabaseApi<AccountRow[]>("/rest/v1/accounts", {
      method: "POST",
      prefer: "return=representation",
      body: JSON.stringify({ username, password_hash: passwordHash, recovery_code_hash: recoveryCodeHash, player_id: playerId, phone: phone || null, role, active: true }),
    });
    return NextResponse.json({ user: publicAccount(created[0]) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error && /duplicate|unique/i.test(error.message)
      ? "Este nome de usuário já está em uso."
      : error instanceof Error ? error.message : "Não foi possível criar o usuário.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
