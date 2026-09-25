import { NextResponse } from "next/server";
import { isActiveAdmin } from "@/lib/admin";
import { supabaseApi } from "@/lib/supabase";

type RaffleRow = { id: number; title: string; price: number; original_price: number | null; total_numbers: number; drawing_date: string; status: string; image_url: string | null; winner_number: number | null; winner_name: string | null; winner_game_id: string | null; winner_phone: string | null };
type PurchaseRow = { id: string; raffle_id: number; buyer_name: string; buyer_game_id: string; buyer_phone: string | null; numbers: number[]; subtotal_value: number | null; total_value: number; discount_percent: number | null; coupon_code: string | null; status: string; created_at: string; reviewed_at: string | null; reviewed_by: string | null; reviewed_by_id: string | null };
type OverviewSummary = {
  raffleCounts: { raffleId: number; sold: number; reserved: number }[];
  stats: { active: number; pending: number; soldNumbers: number; players: number };
};

export async function GET() {
  if (!await isActiveAdmin()) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  try {
    const [raffles, recentPurchases, pendingPurchases, summary] = await Promise.all([
      supabaseApi<RaffleRow[]>("/rest/v1/raffles?select=*&order=id.desc"),
      supabaseApi<PurchaseRow[]>("/rest/v1/purchases?select=*&order=created_at.desc&limit=200"),
      supabaseApi<PurchaseRow[]>("/rest/v1/purchases?select=*&status=eq.pending&order=created_at.asc"),
      supabaseApi<OverviewSummary>("/rest/v1/rpc/get_admin_overview_summary", { method: "POST", body: "{}" }),
    ]);
    const purchases = [...new Map([...pendingPurchases, ...recentPurchases].map((purchase) => [purchase.id, purchase])).values()];
    const raffleTitleById = new Map(raffles.map((raffle) => [raffle.id, raffle.title]));
    const countsByRaffle = new Map(summary.raffleCounts.map((count) => [count.raffleId, count]));
    return NextResponse.json({
      raffles: raffles.map((raffle) => ({ id: raffle.id, title: raffle.title, price: raffle.price, originalPrice: raffle.original_price, totalNumbers: raffle.total_numbers, drawingDate: raffle.drawing_date, status: raffle.status, imageUrl: raffle.image_url, winnerNumber: raffle.winner_number, winnerName: raffle.winner_name, winnerGameId: raffle.winner_game_id, winnerPhone: raffle.winner_phone, sold: Number(countsByRaffle.get(raffle.id)?.sold ?? 0), reserved: Number(countsByRaffle.get(raffle.id)?.reserved ?? 0) })),
      purchases: purchases.map((purchase) => ({ id: purchase.id, raffleId: purchase.raffle_id, raffleTitle: raffleTitleById.get(purchase.raffle_id) ?? `Rifa #${String(purchase.raffle_id).padStart(4, "0")}`, buyerName: purchase.buyer_name, buyerGameId: purchase.buyer_game_id, buyerPhone: purchase.buyer_phone, numbers: purchase.numbers, subtotalValue: purchase.subtotal_value ?? purchase.total_value, totalValue: purchase.total_value, discountPercent: purchase.discount_percent ?? 0, couponCode: purchase.coupon_code, status: purchase.status, createdAt: purchase.created_at, reviewedAt: purchase.reviewed_at, reviewedBy: purchase.reviewed_by, reviewedById: purchase.reviewed_by_id })),
      stats: {
        active: Number(summary.stats.active),
        pending: Number(summary.stats.pending),
        soldNumbers: Number(summary.stats.soldNumbers),
        players: Number(summary.stats.players),
      },
    });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao carregar painel." }, { status: 500 }); }
}
