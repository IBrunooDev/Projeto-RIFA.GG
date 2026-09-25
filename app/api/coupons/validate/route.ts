import { NextResponse } from "next/server";
import { getActiveMember } from "@/lib/member";
import { supabaseApi } from "@/lib/supabase";
import { parsePositiveId, validateCouponCode } from "@/lib/validation";

type CouponPreview = { code: string; discountPercent: number; subtotal: number; discountValue: number; total: number };

export async function POST(request: Request) {
  const member = await getActiveMember();
  if (!member) return NextResponse.json({ error: "Entre na sua conta para usar um cupom." }, { status: 401 });
  try {
    const body = await request.json() as { code?: string; raffleId?: number; numberCount?: number };
    const code = validateCouponCode(body.code ?? "");
    const raffleId = parsePositiveId(body.raffleId);
    const numberCount = Number(body.numberCount);
    if (!raffleId || !Number.isSafeInteger(numberCount) || numberCount < 1 || numberCount > 500) {
      return NextResponse.json({ error: "Selecione os números antes de aplicar o cupom." }, { status: 400 });
    }
    const preview = await supabaseApi<CouponPreview>("/rest/v1/rpc/validate_coupon", {
      method: "POST",
      body: JSON.stringify({ p_code: code, p_raffle_id: raffleId, p_account_id: member.id, p_number_count: numberCount }),
    });
    return NextResponse.json(preview);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Cupom inválido." }, { status: 409 });
  }
}
