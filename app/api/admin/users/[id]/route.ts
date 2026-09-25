import { NextResponse } from "next/server";
import { getActiveAdmin } from "@/lib/admin";
import { setAdminSession } from "@/lib/auth";
import { hashPassword, validatePassword, validateRecoveryCode, validateUsername } from "@/lib/password";
import { supabaseApi } from "@/lib/supabase";
import { isUuid, validatePlayerId, validatePlayerPhone } from "@/lib/validation";

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

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getActiveAdmin();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (session.role !== "owner" && session.role !== "admin") return NextResponse.json({ error: "Somente Dono e Gerente podem alterar usuários." }, { status: 403 });
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return NextResponse.json({ error: "Usuário inválido." }, { status: 400 });
    const body = await request.json() as { username?: string; password?: string; playerId?: string; phone?: string; recoveryCode?: string; active?: boolean; role?: "owner" | "admin" | "sponsor" | "member" };
    const current = await supabaseApi<AccountRow[]>(`/rest/v1/accounts?select=id,username,player_id,phone,role,active,created_at,session_version&id=eq.${encodeURIComponent(id)}&limit=1`);
    const account = current[0];
    if (!account) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });

    if (session.role !== "owner") {
      if (account.role === "owner") return NextResponse.json({ error: "Somente o Dono pode alterar uma conta de Dono." }, { status: 403 });
      if (Object.hasOwn(body, "role") || Object.hasOwn(body, "active")) return NextResponse.json({ error: "Somente o Dono pode gerenciar cargos e bloqueios." }, { status: 403 });
    }
    for (const field of ["username", "password", "playerId", "phone", "recoveryCode"] as const) {
      if (body[field] !== undefined && body[field] !== null && typeof body[field] !== "string") return NextResponse.json({ error: "Dados de conta inválidos." }, { status: 400 });
    }
    const isSelf = session.id === id;
    const username = body.username?.trim() ?? account.username;
    const playerId = validatePlayerId(body.playerId ?? account.player_id ?? "", false);
    const phone = validatePlayerPhone(body.phone ?? account.phone ?? "");
    validateUsername(username);
    if (body.password) validatePassword(body.password);
    if (body.recoveryCode) validateRecoveryCode(body.recoveryCode);
    const allowedRoles = ["owner", "admin", "sponsor", "member"] as const;
    const requestedRole = body.role;
    if (requestedRole !== undefined && !allowedRoles.includes(requestedRole)) return NextResponse.json({ error: "Cargo inválido." }, { status: 400 });
    const role: AccountRow["role"] = requestedRole && allowedRoles.includes(requestedRole) ? requestedRole : account.role;
    if (isSelf && (body.active === false || role !== session.role)) {
      return NextResponse.json({ error: "Você não pode remover o acesso da sua própria conta administrativa." }, { status: 400 });
    }

    const changes: Record<string, unknown> = {
      username,
      player_id: playerId || null,
      phone: phone || null,
      active: typeof body.active === "boolean" ? body.active : account.active,
      role,
      updated_at: new Date().toISOString(),
    };
    if (body.password) {
      changes.password_hash = await hashPassword(body.password);
      changes.session_version = account.session_version + 1;
      changes.login_failed_attempts = 0;
      changes.login_locked_until = null;
    }
    if (body.recoveryCode) {
      changes.recovery_code_hash = await hashPassword(body.recoveryCode);
      changes.recovery_failed_attempts = 0;
      changes.recovery_locked_until = null;
    }

    if (body.password || body.recoveryCode || username !== account.username || role !== account.role || changes.active !== account.active) {
      changes.session_version = account.session_version + 1;
    }

    const updated = await supabaseApi<AccountRow[]>(`/rest/v1/accounts?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      prefer: "return=representation",
      body: JSON.stringify(changes),
    });
    const result = updated[0];
    if (!result) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    if (isSelf && (result.role === "owner" || result.role === "admin" || result.role === "sponsor")) {
      await setAdminSession({ id: result.id, username: result.username, playerId: result.player_id, role: result.role, sessionVersion: result.session_version });
    }
    return NextResponse.json({
      user: { id: result.id, username: result.username, playerId: result.player_id, phone: result.phone, role: result.role, active: result.active, createdAt: result.created_at },
    });
  } catch (error) {
    const message = error instanceof Error && /duplicate|unique/i.test(error.message)
      ? "Este nome de usuário já está em uso."
      : error instanceof Error ? error.message : "Não foi possível atualizar o usuário.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getActiveAdmin();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (session.role !== "owner") return NextResponse.json({ error: "Somente o Dono pode excluir contas." }, { status: 403 });
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return NextResponse.json({ error: "Usuário inválido." }, { status: 400 });
    if (session.id === id) return NextResponse.json({ error: "Você não pode excluir sua própria conta de Dono." }, { status: 400 });
    const current = await supabaseApi<AccountRow[]>(`/rest/v1/accounts?select=id,username,player_id,phone,role,active,created_at,session_version&id=eq.${encodeURIComponent(id)}&limit=1`);
    const account = current[0];
    if (!account) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    await supabaseApi<unknown>(`/rest/v1/accounts?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível excluir a conta." }, { status: 409 });
  }
}
