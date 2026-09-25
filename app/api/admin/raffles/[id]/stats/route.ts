import { NextResponse } from "next/server";
import { getActiveAdmin } from "@/lib/admin";
import { supabaseApi } from "@/lib/supabase";
import { parsePositiveId } from "@/lib/validation";

type RaffleStatistics = {
  sold: number;
  reserved: number;
  free: number;
  totalNumbers: number;
  totalConfirmed: number;
  dailySales: { date: string; count: number }[];
  freeNumbers: number[];
};

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await getActiveAdmin();
  if (!admin) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  try {
    const { id } = await context.params;
    const raffleId = parsePositiveId(id);
    if (!raffleId) return NextResponse.json({ error: "Rifa inválida." }, { status: 400 });

    const statistics = await supabaseApi<RaffleStatistics>("/rest/v1/rpc/get_raffle_statistics", {
      method: "POST",
      body: JSON.stringify({ p_raffle_id: raffleId, p_actor_id: admin.id }),
    });
    return NextResponse.json(statistics);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível carregar as estatísticas." }, { status: 500 });
  }
}
