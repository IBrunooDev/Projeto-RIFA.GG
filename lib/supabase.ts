type ApiOptions = RequestInit & { prefer?: string };

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configure SUPABASE_URL e SUPABASE_SECRET_KEY na Vercel.");
  return { url, key, legacyJwt: !key.startsWith("sb_secret_") };
}

export async function supabaseApi<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { url, key, legacyJwt } = config();
  const headers = new Headers(options.headers);
  headers.set("apikey", key);
  if (legacyJwt) headers.set("authorization", `Bearer ${key}`);
  if (options.body && !(options.body instanceof FormData) && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (options.prefer) headers.set("prefer", options.prefer);

  const timeout = AbortSignal.timeout(15_000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  const response = await fetch(`${url}${path}`, { ...options, headers, signal, cache: "no-store" });
  if (!response.ok) {
    const body = await response.text();
    let message = body;
    try { message = (JSON.parse(body) as { message?: string }).message ?? body; } catch { /* mantém texto */ }
    throw new Error(message || `Erro ${response.status} no banco de dados.`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function uploadRaffleImage(file: File) {
  const { url, key, legacyJwt } = config();
  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
  if (!allowedTypes.has(file.type) || file.size < 1 || file.size > 5_000_000) {
    throw new Error("Envie uma imagem JPG, PNG, WEBP ou GIF de até 5 MB.");
  }
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const objectName = `${crypto.randomUUID()}-${safeName}`;
  const response = await fetch(`${url}/storage/v1/object/raffle-images/${objectName}`, {
    method: "POST",
    headers: { apikey: key, ...(legacyJwt ? { authorization: `Bearer ${key}` } : {}), "content-type": file.type, "x-upsert": "false" },
    signal: AbortSignal.timeout(20_000),
    body: await file.arrayBuffer(),
  });
  if (!response.ok) throw new Error("Não foi possível enviar a imagem para o Supabase.");
  return `${url}/storage/v1/object/public/raffle-images/${objectName}`;
}

export async function deleteRaffleImage(imageUrl: string | null | undefined) {
  if (!imageUrl) return;
  const { url, key, legacyJwt } = config();
  const publicPrefix = `${url}/storage/v1/object/public/raffle-images/`;
  if (!imageUrl.startsWith(publicPrefix)) return;
  const objectName = decodeURIComponent(imageUrl.slice(publicPrefix.length));
  if (!objectName || !/^[a-zA-Z0-9._-]+$/.test(objectName)) return;
  const response = await fetch(`${url}/storage/v1/object/raffle-images/${encodeURIComponent(objectName)}`, {
    method: "DELETE",
    headers: { apikey: key, ...(legacyJwt ? { authorization: `Bearer ${key}` } : {}) },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok && response.status !== 404) throw new Error("Não foi possível remover a imagem antiga do Supabase.");
}
