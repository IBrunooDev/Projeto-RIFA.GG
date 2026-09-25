import { NextResponse } from "next/server";
import { getActiveMember } from "@/lib/member";
import { supabaseApi } from "@/lib/supabase";

type Purchase = { id: string; buyer_name: string; buyer_game_id: string; buyer_phone: string | null; numbers: number[]; subtotal_value: number | null; total_value: number; discount_percent: number | null; coupon_code: string | null; status: string; created_at: string; raffles: { title: string; status: string; winner_number: number | null } | null };

export async function GET() {
  const session = await getActiveMember();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  try {
    const rows = await supabaseApi<Purchase[]>(`/rest/v1/purchases?select=id,buyer_name,buyer_game_id,buyer_phone,numbers,subtotal_value,total_value,discount_percent,coupon_code,status,created_at,raffles(title,status,winner_number)&account_id=eq.${session.id}&order=created_at.desc`);
    return NextResponse.json({ purchases: rows.map((item) => ({ id: item.id, buyerName: item.buyer_name, buyerGameId: item.buyer_game_id, buyerPhone: item.buyer_phone, numbers: item.numbers, subtotalValue: item.subtotal_value ?? item.total_value, totalValue: item.total_value, discountPercent: item.discount_percent ?? 0, couponCode: item.coupon_code, status: item.status, createdAt: item.created_at, raffle: item.raffles })) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao carregar compras." }, { status: 500 }); }
}
