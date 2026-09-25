import { NextResponse } from "next/server";
import { getActiveAdmin } from "@/lib/admin";
import { deleteRaffleImage, supabaseApi, uploadRaffleImage } from "@/lib/supabase";
import { validateImageUrl, validateRaffleDate, validateRaffleDescription, validateRaffleTitle } from "@/lib/validation";

export async function POST(request: Request) {
  const admin = await getActiveAdmin();
  if (!admin) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  let uploadedImageUrl: string | null = null;
  try {
    const form = await request.formData();
    const title = validateRaffleTitle(String(form.get("title") ?? ""));
    const description = validateRaffleDescription(String(form.get("description") ?? ""));
    const price = Number(form.get("price"));
    const totalNumbers = Number(form.get("totalNumbers"));
    const drawingDate = validateRaffleDate(String(form.get("drawingDate") ?? ""));
    if (!Number.isSafeInteger(price) || price < 1 || !Number.isSafeInteger(totalNumbers) || totalNumbers < 10 || totalNumbers > 500) return NextResponse.json({ error: "Informe um valor positivo e uma quantidade entre 10 e 500." }, { status: 400 });

    let imageUrl = validateImageUrl(String(form.get("imageUrl") ?? ""));
    const image = form.get("image");
    if (image instanceof File && image.size > 0) {
      uploadedImageUrl = await uploadRaffleImage(image);
      imageUrl = uploadedImageUrl;
    }
    const raffleId = await supabaseApi<number>("/rest/v1/rpc/create_raffle", { method: "POST", body: JSON.stringify({ p_title: title, p_description: description, p_price: price, p_total_numbers: totalNumbers, p_drawing_date: drawingDate, p_image_url: imageUrl, p_actor_id: admin.id, p_actor: admin.username }) });
    return NextResponse.json({ raffleId }, { status: 201 });
  } catch (error) {
    if (uploadedImageUrl) await deleteRaffleImage(uploadedImageUrl).catch(() => undefined);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível criar a rifa." }, { status: 409 });
  }
}
