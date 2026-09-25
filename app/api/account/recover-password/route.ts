import { NextResponse } from "next/server";
import { DUMMY_PASSWORD_HASH, hashPassword, validatePassword, validateRecoveryCode, validateUsername, verifyPassword } from "@/lib/password";
import { supabaseApi } from "@/lib/supabase";
import { validatePlayerId } from "@/lib/validation";

type RecoveryAccount = {
  id: string;
  username: string;
  player_id: string | null;
  password_hash: string;
  recovery_code_hash: string | null;
  recovery_failed_attempts: number;
  recovery_locked_until: string | null;
  active: boolean;
  session_version: number;
};

const INVALID_RECOVERY = "Os dados de recuperação estão incorretos.";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { username?: string; playerId?: string; recoveryCode?: string; newPassword?: string; confirmPassword?: string };
    const username = body.username?.trim() ?? "";
    const playerId = validatePlayerId(body.playerId ?? "", false);
    const recoveryCode = body.recoveryCode ?? "";
    const newPassword = body.newPassword ?? "";
    validateUsername(username);
    validateRecoveryCode(recoveryCode);
    validatePassword(newPassword);
    if (newPassword !== body.confirmPassword) return NextResponse.json({ error: "As novas senhas não coincidem." }, { status: 400 });

    const accounts = await supabaseApi<RecoveryAccount[]>("/rest/v1/rpc/get_account_for_auth", { method: "POST", body: JSON.stringify({ p_username: username }) });
    const account = accounts[0];
    if (!account) {
      await verifyPassword(recoveryCode, DUMMY_PASSWORD_HASH);
      return NextResponse.json({ error: INVALID_RECOVERY }, { status: 401 });
    }

    const lockedUntil = account.recovery_locked_until ? new Date(account.recovery_locked_until).getTime() : 0;
    if (lockedUntil > Date.now()) {
      return NextResponse.json({ error: "Muitas tentativas. Aguarde 15 minutos antes de tentar novamente." }, { status: 429 });
    }

    const playerMatches = account.player_id ? account.player_id === playerId : playerId === "";
    const recoveryMatches = account.recovery_code_hash
      ? await verifyPassword(recoveryCode, account.recovery_code_hash)
      : await verifyPassword(recoveryCode, DUMMY_PASSWORD_HASH);
    if (!account.active || !playerMatches || !recoveryMatches) {
      const result = await supabaseApi<{ locked: boolean }>("/rest/v1/rpc/record_recovery_failure", { method: "POST", body: JSON.stringify({ p_account_id: account.id }) });
      return NextResponse.json({ error: result.locked ? "Muitas tentativas. Aguarde 15 minutos antes de tentar novamente." : INVALID_RECOVERY }, { status: result.locked ? 429 : 401 });
    }

    await supabaseApi<unknown>("/rest/v1/rpc/apply_recovered_password", { method: "POST", body: JSON.stringify({ p_account_id: account.id, p_password_hash: await hashPassword(newPassword) }) });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível trocar a senha." }, { status: 400 });
  }
}
