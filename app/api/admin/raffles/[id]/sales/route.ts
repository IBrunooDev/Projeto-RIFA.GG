import { NextResponse } from "next/server";
import { getActiveManager } from "@/lib/admin";
import { supabaseApi } from "@/lib/supabase";
import { normalizeNumbers, parsePositiveId, validateBuyerGameId, validateBuyerName, validateBuyerPhone } from "@/lib/validation";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await getActiveManager();
  if (!admin) return NextResponse.json({ error: "Somente o Dono ou Gerente pode registrar compras manualmente." }, { status: 403 });
  try {
    const { id } = await context.params;
    const body = await request.json() as { buyerName?: string; buyerGameId?: string; buyerPhone?: string; numbers?: number[] };
    const raffleId = parsePositiveId(id);
    const buyerName = validateBuyerName(body.buyerName ?? "");
    const buyerGameId = validateBuyerGameId(body.buyerGameId ?? "");
    const buyerPhone = validateBuyerPhone(body.buyerPhone ?? "");
    const numbers = normalizeNumbers(body.numbers);
    if (!raffleId || !numbers.length) return NextResponse.json({ error: "Informe uma rifa e pelo menos um número válido." }, { status: 400 });
    const purchaseId = await supabaseApi<string>("/rest/v1/rpc/register_manual_sale", { method: "POST", body: JSON.stringify({ p_raffle_id: raffleId, p_buyer_name: buyerName, p_buyer_game_id: buyerGameId, p_buyer_phone: buyerPhone, p_numbers: numbers, p_actor_id: admin.id, p_actor: admin.username }) });
    return NextResponse.json({ purchaseId }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível registrar a compra." }, { status: 409 }); }
}
