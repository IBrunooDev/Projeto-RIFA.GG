import { NextResponse } from "next/server";
import { getActiveManager } from "@/lib/admin";
import { supabaseApi } from "@/lib/supabase";
import { parsePositiveId } from "@/lib/validation";

type Winner = { raffleId: number; title: string; number: number; name: string; gameId: string; phone?: string | null };

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await getActiveManager();
  if (!admin) return NextResponse.json({ error: "Somente o Dono ou Gerente pode realizar o sorteio." }, { status: 403 });
  try {
    const { id } = await context.params;
    const raffleId = parsePositiveId(id);
    if (!raffleId) return NextResponse.json({ error: "Rifa inválida." }, { status: 400 });
    const winner = await supabaseApi<Winner>("/rest/v1/rpc/draw_raffle", { method: "POST", body: JSON.stringify({ p_raffle_id: raffleId, p_actor_id: admin.id, p_actor: admin.username }) });
    let discordSent = false;
    if (process.env.DISCORD_WEBHOOK_URL) {
      try {
        const response = await fetch(process.env.DISCORD_WEBHOOK_URL, { method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(10_000), body: JSON.stringify({ username: "Rifa.GG", allowed_mentions: { parse: [] }, embeds: [{ title: `🏆 Vencedor — ${winner.title}`, color: 11796268, fields: [{ name: "Número", value: String(winner.number), inline: true }, { name: "Jogador", value: winner.name, inline: true }, { name: "ID no jogo", value: winner.gameId, inline: true }, { name: "Telefone no jogo", value: winner.phone || "Não informado", inline: true }], footer: { text: "Resultado registrado pela Rifa.GG" }, timestamp: new Date().toISOString() }] }) });
        discordSent = response.ok;
      } catch {
        discordSent = false;
      }
    }
    return NextResponse.json({ winner, discordSent });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível sortear." }, { status: 409 }); }
}
