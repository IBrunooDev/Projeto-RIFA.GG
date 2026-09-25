import { NextResponse } from "next/server";
import { getActiveAdmin } from "@/lib/admin";
import { deleteRaffleImage, supabaseApi, uploadRaffleImage } from "@/lib/supabase";
import { parsePositiveId, validateImageUrl, validateRaffleDate, validateRaffleTitle } from "@/lib/validation";

function parseRaffleId(id: string) {
  return parsePositiveId(id);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getActiveAdmin();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  let uploadedImageUrl: string | null = null;
  try {
    const { id } = await context.params;
    const raffleId = parseRaffleId(id);
    if (!raffleId) return NextResponse.json({ error: "Rifa inválida." }, { status: 400 });
    const currentRows = await supabaseApi<{ image_url: string | null }[]>(`/rest/v1/raffles?select=image_url&id=eq.${raffleId}&limit=1`);
    if (!currentRows[0]) return NextResponse.json({ error: "Rifa não encontrada." }, { status: 404 });
    const oldImageUrl = currentRows[0].image_url;
    const form = await request.formData();
    const title = validateRaffleTitle(String(form.get("title") ?? ""));
    const price = Number(form.get("price"));
    const drawingDate = validateRaffleDate(String(form.get("drawingDate") ?? ""));
    if (!Number.isSafeInteger(price) || price < 1) {
      return NextResponse.json({ error: "Informe um nome, um valor e uma data válidos." }, { status: 400 });
    }

    let imageUrl = validateImageUrl(String(form.get("imageUrl") ?? ""));
    const image = form.get("image");
    if (image instanceof File && image.size > 0) {
      uploadedImageUrl = await uploadRaffleImage(image);
      imageUrl = uploadedImageUrl;
    }

    const updated = await supabaseApi<{ title: string; price: number; originalPrice: number | null; drawingDate: string; imageUrl: string | null }>("/rest/v1/rpc/update_raffle_details", {
      method: "POST",
      body: JSON.stringify({ p_raffle_id: raffleId, p_title: title, p_price: price, p_drawing_date: drawingDate, p_image_url: imageUrl || null, p_actor_id: session.id, p_actor: session.username }),
    });
    if (oldImageUrl && oldImageUrl !== updated.imageUrl) await deleteRaffleImage(oldImageUrl).catch(() => undefined);
    return NextResponse.json({ ok: true, ...updated });
  } catch (error) {
    if (uploadedImageUrl) await deleteRaffleImage(uploadedImageUrl).catch(() => undefined);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível editar a rifa." }, { status: 409 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getActiveAdmin();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (session.role !== "owner") return NextResponse.json({ error: "Somente o Dono pode excluir rifas." }, { status: 403 });
  try {
    const { id } = await context.params;
    const raffleId = parseRaffleId(id);
    if (!raffleId) return NextResponse.json({ error: "Rifa inválida." }, { status: 400 });
    const currentRows = await supabaseApi<{ image_url: string | null }[]>(`/rest/v1/raffles?select=image_url&id=eq.${raffleId}&limit=1`);
    if (!currentRows[0]) return NextResponse.json({ error: "Rifa não encontrada." }, { status: 404 });
    await supabaseApi<unknown>("/rest/v1/rpc/delete_raffle", {
      method: "POST",
      body: JSON.stringify({ p_raffle_id: raffleId, p_actor_id: session.id, p_actor: session.username }),
    });
    await deleteRaffleImage(currentRows[0].image_url).catch(() => undefined);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível excluir a rifa." }, { status: 409 });
  }
}
