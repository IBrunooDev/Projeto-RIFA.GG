import { NextResponse } from "next/server";
import { getActiveMember } from "@/lib/member";
import { hashPassword, validatePassword, validateRecoveryCode, verifyPassword } from "@/lib/password";
import { supabaseApi } from "@/lib/supabase";

type Account = { id: string; password_hash: string };

export async function PATCH(request: Request) {
  const session = await getActiveMember();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  try {
    const body = await request.json() as { currentPassword?: string; recoveryCode?: string };
    const currentPassword = body.currentPassword ?? "";
    const recoveryCode = body.recoveryCode ?? "";
    validatePassword(currentPassword);
    validateRecoveryCode(recoveryCode);
    const accounts = await supabaseApi<Account[]>(`/rest/v1/accounts?select=id,password_hash&id=eq.${encodeURIComponent(session.id)}&limit=1`);
    const account = accounts[0];
    if (!account || !await verifyPassword(currentPassword, account.password_hash)) {
      return NextResponse.json({ error: "A senha atual está incorreta." }, { status: 401 });
    }
    await supabaseApi<unknown>(`/rest/v1/accounts?id=eq.${encodeURIComponent(session.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ recovery_code_hash: await hashPassword(recoveryCode), recovery_failed_attempts: 0, recovery_locked_until: null, updated_at: new Date().toISOString() }),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível salvar a chave de recuperação." }, { status: 400 });
  }
}
