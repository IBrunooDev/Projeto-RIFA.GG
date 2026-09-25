import { NextResponse } from "next/server";
import { getActiveManager } from "@/lib/admin";

export async function POST() {
  if (!await getActiveManager()) return NextResponse.json({ error: "Somente o Dono ou Gerente pode testar integrações." }, { status: 403 });

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL?.trim();
  if (!webhookUrl) return NextResponse.json({ error: "Configure DISCORD_WEBHOOK_URL na Vercel antes de testar." }, { status: 400 });

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        username: "Rifa.GG",
        allowed_mentions: { parse: [] },
        embeds: [{
          title: "🧪 Teste do webhook — Rifa.GG",
          description: "Esta é uma simulação. Nenhuma rifa ou compra foi criada no sistema.",
          color: 11796268,
          fields: [
            { name: "Rifa", value: "Rifa de teste (não existe)", inline: false },
            { name: "Número sorteado", value: "07", inline: true },
            { name: "Jogador", value: "JogadorTeste", inline: true },
            { name: "ID no jogo", value: "12345", inline: true },
            { name: "Telefone no jogo", value: "123456", inline: true },
          ],
          footer: { text: "Mensagem de teste — nenhum resultado real foi registrado" },
          timestamp: new Date().toISOString(),
        }],
      }),
    });

    if (!response.ok) return NextResponse.json({ error: "O Discord recusou o teste. Confira o link do webhook." }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Não foi possível conectar ao webhook do Discord." }, { status: 502 });
  }
}
