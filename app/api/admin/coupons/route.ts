import { NextResponse } from "next/server";
import { getActiveAdmin } from "@/lib/admin";
import { supabaseApi } from "@/lib/supabase";
import { parsePositiveId, validateCouponCode } from "@/lib/validation";

type CouponRow = { id: string; code: string; discount_percent: number; min_numbers: number; raffle_id: number | null; max_uses: number | null; used_count: number; expires_at: string | null; active: boolean; created_by_name: string; created_at: string; raffles: { title: string } | null };

export async function GET() {
  if (!await getActiveAdmin()) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  try {
    const rows = await supabaseApi<CouponRow[]>("/rest/v1/coupons?select=id,code,discount_percent,min_numbers,raffle_id,max_uses,used_count,expires_at,active,created_by_name,created_at,raffles(title)&order=created_at.desc");
    return NextResponse.json({ coupons: rows.map((item) => ({ id: item.id, code: item.code, discountPercent: item.discount_percent, minNumbers: item.min_numbers, raffleId: item.raffle_id, raffleTitle: item.raffles?.title ?? null, maxUses: item.max_uses, usedCount: item.used_count, expiresAt: item.expires_at, active: item.active, createdBy: item.created_by_name, createdAt: item.created_at })) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao carregar cupons." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const admin = await getActiveAdmin();
  if (!admin) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  try {
    const body = await request.json() as { code?: string; discountPercent?: number; minNumbers?: number; raffleId?: number | null; maxUses?: number | null; expiresAt?: string | null };
    const code = validateCouponCode(body.code ?? "");
    const discountPercent = Number(body.discountPercent);
    const minNumbers = Number(body.minNumbers ?? 1);
    const raffleId = body.raffleId ? parsePositiveId(body.raffleId) : null;
    const maxUses = body.maxUses ? Number(body.maxUses) : null;
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    if (!Number.isSafeInteger(discountPercent) || discountPercent < 1 || discountPercent > 100) throw new Error("O desconto deve ser de 1% a 100%.");
    if (!Number.isSafeInteger(minNumbers) || minNumbers < 1 || minNumbers > 500) throw new Error("A quantidade mínima deve ser de 1 a 500 números.");
    if (body.raffleId && !raffleId) throw new Error("Rifa inválida.");
    if (maxUses !== null && (!Number.isSafeInteger(maxUses) || maxUses < 1 || maxUses > 1_000_000)) throw new Error("O limite de usos deve ser um número positivo.");
    if (expiresAt && (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now())) throw new Error("A validade precisa ser uma data futura.");
    const id = await supabaseApi<string>("/rest/v1/rpc/create_coupon", {
      method: "POST",
      body: JSON.stringify({ p_code: code, p_discount_percent: discountPercent, p_raffle_id: raffleId, p_max_uses: maxUses, p_expires_at: expiresAt?.toISOString() ?? null, p_actor_id: admin.id, p_actor: admin.username, p_min_numbers: minNumbers }),
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível criar o cupom.";
    return NextResponse.json({ error: message.includes("duplicate key") ? "Já existe um cupom com esse código." : message }, { status: 409 });
  }
}
