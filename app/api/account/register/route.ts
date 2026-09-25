import { NextResponse } from "next/server";
import { setMemberSession } from "@/lib/auth";
import { hashPassword, validatePassword, validateRecoveryCode, validateUsername } from "@/lib/password";
import { supabaseApi } from "@/lib/supabase";
import { validatePlayerId } from "@/lib/validation";

import { registrationIp } from "@/lib/registration-ip";

type Account = { id: string; username: string; player_id: string | null; session_version: number };

export async function POST(request: Request) {
  try {
    const ip = registrationIp(request);
    const body = await request.json() as { username?: string; password?: string; playerId?: string; recoveryCode?: string };
    const username = body.username?.trim() ?? ""; const password = body.password ?? ""; const playerId = validatePlayerId(body.playerId ?? ""); const recoveryCode = body.recoveryCode ?? "";
    validateUsername(username); validatePassword(password); validateRecoveryCode(recoveryCode);
    const [passwordHash, recoveryCodeHash] = await Promise.all([hashPassword(password), hashPassword(recoveryCode)]);
    const account = await supabaseApi<Account[]>("/rest/v1/accounts", { method: "POST", prefer: "return=representation", body: JSON.stringify({ username, password_hash: passwordHash, recovery_code_hash: recoveryCodeHash, player_id: playerId, role: "member", active: true, registration_ip: ip }) });
    await setMemberSession({ id: account[0].id, username: account[0].username, playerId: account[0].player_id, sessionVersion: account[0].session_version });
    return NextResponse.json({ account: { id: account[0].id, username: account[0].username, playerId: account[0].player_id } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error && /accounts_registration_ip_unique/i.test(error.message) ? "Já existe uma conta cadastrada nesta conexão. Entre na sua conta ou fale com o suporte." : error instanceof Error && /duplicate|unique/i.test(error.message) ? "Este nome de usuário já está em uso." : error instanceof Error ? error.message : "Não foi possível criar a conta.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
