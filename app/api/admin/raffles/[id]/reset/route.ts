import { NextResponse } from "next/server";
import { getActiveAdmin } from "@/lib/admin";
import { supabaseApi } from "@/lib/supabase";
import { parsePositiveId } from "@/lib/validation";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getActiveAdmin();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (session.role !== "owner") return NextResponse.json({ error: "Somente o Dono pode resetar rifas." }, { status: 403 });
  try {
    const { id } = await context.params;
    const raffleId = parsePositiveId(id);
    if (!raffleId) return NextResponse.json({ error: "Rifa inválida." }, { status: 400 });
    await supabaseApi<unknown>("/rest/v1/rpc/reset_raffle", {
      method: "POST",
      body: JSON.stringify({ p_raffle_id: raffleId, p_actor_id: session.id, p_actor: session.username }),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível resetar a rifa." }, { status: 409 });
  }
}
