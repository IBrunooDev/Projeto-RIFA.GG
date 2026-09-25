import { NextResponse } from "next/server";
import { getActiveAdmin } from "@/lib/admin";
import { supabaseApi } from "@/lib/supabase";
import { isUuid } from "@/lib/validation";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await getActiveAdmin();
  if (!admin) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return NextResponse.json({ error: "Compra inválida." }, { status: 400 });
    const { action } = await request.json() as { action?: "approve" | "reject" };
    if (action !== "approve" && action !== "reject") return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
    const status = await supabaseApi<string>("/rest/v1/rpc/review_purchase", { method: "POST", body: JSON.stringify({ p_purchase_id: id, p_action: action, p_actor_id: admin.id, p_actor: admin.username }) });
    return NextResponse.json({ status });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível revisar o pedido." }, { status: 409 }); }
}
