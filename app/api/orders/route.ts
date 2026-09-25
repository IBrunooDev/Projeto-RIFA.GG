import { NextResponse } from "next/server";
import { getActiveMember } from "@/lib/member";
import { supabaseApi } from "@/lib/supabase";
import { normalizeNumbers, parsePositiveId, validateBuyerGameId, validateBuyerName, validateBuyerPhone, validateCouponCode } from "@/lib/validation";
import { TERMS_VERSION } from "@/lib/terms";

export async function POST(request: Request) {
  try {
    const session = await getActiveMember();
    if (!session) return NextResponse.json({ error: "Entre ou crie uma conta antes de reservar." }, { status: 401 });
    const body = await request.json() as { raffleId?: number; buyerName?: string; buyerGameId?: string; buyerPhone?: string; numbers?: number[]; couponCode?: string; termsAccepted?: boolean; termsVersion?: string };
    if (body.termsAccepted !== true || body.termsVersion !== TERMS_VERSION) {
      return NextResponse.json({ error: "Aceite os Termos de Uso para continuar." }, { status: 400 });
    }
    const raffleId = parsePositiveId(body.raffleId);
    const buyerName = validateBuyerName(body.buyerName ?? "");
    const buyerGameId = validateBuyerGameId(body.buyerGameId ?? "");
    const buyerPhone = validateBuyerPhone(body.buyerPhone ?? "");
    const numbers = normalizeNumbers(body.numbers);
    const couponCode = validateCouponCode(body.couponCode ?? "", false);
    if (!raffleId || !numbers.length) return NextResponse.json({ error: "Escolha pelo menos um número válido." }, { status: 400 });
    const purchaseId = await supabaseApi<string>("/rest/v1/rpc/create_reservation", {
      method: "POST",
      body: JSON.stringify({ p_raffle_id: raffleId, p_account_id: session.id, p_buyer_name: buyerName, p_buyer_game_id: buyerGameId, p_buyer_phone: buyerPhone, p_numbers: numbers, p_coupon_code: couponCode || null }),
    });
    return NextResponse.json({ purchaseId }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: friendlyError(error) }, { status: 409 }); }
}

function friendlyError(error: unknown) { return error instanceof Error ? error.message : "Não foi possível reservar."; }
