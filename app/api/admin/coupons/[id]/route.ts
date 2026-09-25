import { NextResponse } from "next/server";
import { getActiveAdmin } from "@/lib/admin";
import { supabaseApi } from "@/lib/supabase";
import { isUuid } from "@/lib/validation";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await getActiveAdmin();
  if (!admin) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return NextResponse.json({ error: "Cupom inválido." }, { status: 400 });
    const body = await request.json() as { active?: boolean; discountPercent?: number; minNumbers?: number };
    if (typeof body.active === "boolean") {
      await supabaseApi<string>("/rest/v1/rpc/set_coupon_active", { method: "POST", body: JSON.stringify({ p_coupon_id: id, p_active: body.active, p_actor_id: admin.id, p_actor: admin.username }) });
      return NextResponse.json({ active: body.active });
    }
    const discountPercent = Number(body.discountPercent);
    const minNumbers = Number(body.minNumbers);
    if (!Number.isSafeInteger(discountPercent) || discountPercent < 1 || discountPercent > 100) return NextResponse.json({ error: "O desconto deve ser de 1% a 100%." }, { status: 400 });
    if (!Number.isSafeInteger(minNumbers) || minNumbers < 1 || minNumbers > 500) return NextResponse.json({ error: "A quantidade mínima deve ser de 1 a 500 números." }, { status: 400 });
    await supabaseApi<string>("/rest/v1/rpc/update_coupon_details", { method: "POST", body: JSON.stringify({ p_coupon_id: id, p_discount_percent: discountPercent, p_min_numbers: minNumbers, p_actor_id: admin.id, p_actor: admin.username }) });
    return NextResponse.json({ discountPercent, minNumbers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível alterar o cupom." }, { status: 409 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await getActiveAdmin();
  if (!admin) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return NextResponse.json({ error: "Cupom inválido." }, { status: 400 });
    const code = await supabaseApi<string>("/rest/v1/rpc/delete_coupon", {
      method: "POST",
      body: JSON.stringify({ p_coupon_id: id, p_actor_id: admin.id, p_actor: admin.username }),
    });
    return NextResponse.json({ ok: true, code });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível excluir o cupom." }, { status: 409 });
  }
}
