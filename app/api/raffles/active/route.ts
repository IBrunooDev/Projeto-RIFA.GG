import { NextResponse } from "next/server";
import { supabaseApi } from "@/lib/supabase";

type RaffleRow = { id: number; title: string; description: string; price: number; original_price: number | null; total_numbers: number; drawing_date: string; image_url: string | null; winner_number: number | null; winner_name: string | null; winner_game_id: string | null };
type NumberRow = { number: number; status: "available" | "reserved" | "sold" };

export async function GET() {
  try {
    const active = await supabaseApi<RaffleRow[]>("/rest/v1/raffles?select=*&status=eq.active&order=id.desc&limit=1");
    const completed = await supabaseApi<RaffleRow[]>("/rest/v1/raffles?select=*&status=eq.completed&order=id.desc&limit=10");
    const winners = completed.filter((item) => item.winner_number && item.winner_name).map(mapWinner);
    if (!active[0]) return NextResponse.json({ raffle: null, numbers: [], winners, previousWinner: winners[0] ?? null });
    const numbers = await supabaseApi<NumberRow[]>(`/rest/v1/raffle_numbers?select=number,status&raffle_id=eq.${active[0].id}&order=number.asc`);
    return NextResponse.json({
      raffle: mapRaffle(active[0]),
      numbers,
      winners,
      previousWinner: winners[0] ?? null,
    });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao carregar a rifa." }, { status: 500 }); }
}

function mapWinner(row: RaffleRow) {
  return { id: row.id, title: row.title, winnerNumber: row.winner_number, winnerName: row.winner_name, winnerGameId: row.winner_game_id };
}

function mapRaffle(row: RaffleRow) {
  return { id: row.id, title: row.title, description: row.description, price: row.price, originalPrice: row.original_price, totalNumbers: row.total_numbers, drawingDate: row.drawing_date, imageUrl: row.image_url };
}
