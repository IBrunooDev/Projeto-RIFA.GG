import { NextResponse } from "next/server";
import { setMemberSession } from "@/lib/auth";
import { DUMMY_PASSWORD_HASH, validateUsername, verifyPassword } from "@/lib/password";
import { supabaseApi } from "@/lib/supabase";
import { clearLoginFailures, isLoginLocked, recordLoginFailure, type LoginSecurity } from "@/lib/login-security";

type Account = LoginSecurity & { id: string; username: string; password_hash: string; player_id: string | null; active: boolean; role: string; session_version: number };

export async function POST(request: Request) {
  try {
    const body = await request.json() as { username?: string; password?: string };
    const username = body.username?.trim() ?? ""; const password = body.password ?? "";
    validateUsername(username);
    if (!password || password.length > 128) return NextResponse.json({ error: "Usuário ou senha incorretos." }, { status: 401 });
    const accounts = await supabaseApi<Account[]>("/rest/v1/rpc/get_account_for_auth", { method: "POST", body: JSON.stringify({ p_username: username }) });
    const account = accounts[0];
    if (!account) {
      await verifyPassword(password, DUMMY_PASSWORD_HASH);
      return NextResponse.json({ error: "Usuário ou senha incorretos." }, { status: 401 });
    }
    if (isLoginLocked(account)) return NextResponse.json({ error: "Muitas tentativas. Aguarde 15 minutos antes de tentar novamente." }, { status: 429 });
    const passwordMatches = await verifyPassword(password, account.password_hash);
    if (account.role !== "member" || !account.active || !passwordMatches) {
      if (account.active && account.role === "member") {
        const result = await recordLoginFailure(account.id);
        if (result.locked) return NextResponse.json({ error: "Muitas tentativas. Aguarde 15 minutos antes de tentar novamente." }, { status: 429 });
      }
      return NextResponse.json({ error: "Usuário ou senha incorretos." }, { status: 401 });
    }
    await clearLoginFailures(account.id);
    await setMemberSession({ id: account.id, username: account.username, playerId: account.player_id, sessionVersion: account.session_version });
    return NextResponse.json({ account: { id: account.id, username: account.username, playerId: account.player_id } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível entrar." }, { status: 400 }); }
}
