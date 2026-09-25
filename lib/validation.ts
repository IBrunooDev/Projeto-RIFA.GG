const IMAGE_PROTOCOLS = new Set(["http:", "https:"]);

export function validatePlayerId(value: string, required = true) {
  const clean = value.trim();
  if (required && !clean) throw new Error("Informe o ID dentro do jogo.");
  if (clean.length > 50) throw new Error("O ID dentro do jogo deve ter no máximo 50 caracteres.");
  return clean;
}

export function validateBuyerName(value: string) {
  const clean = value.trim();
  if (clean.length < 2 || clean.length > 50) throw new Error("O nome do jogador deve ter de 2 a 50 caracteres.");
  return clean;
}

export function validateBuyerGameId(value: string) {
  const clean = value.trim();
  if (!clean || clean.length > 50) throw new Error("O ID do jogador deve ter de 1 a 50 caracteres.");
  return clean;
}

export function validateBuyerPhone(value: string) {
  const clean = value.trim();
  if (!/^[0-9]{1,6}$/.test(clean)) throw new Error("O telefone no jogo deve ter de 1 a 6 dígitos.");
  return clean;
}

export function validatePlayerPhone(value: string, required = false) {
  const clean = value.trim();
  if (!clean && !required) return "";
  if (!/^[0-9]{1,6}$/.test(clean)) throw new Error("O telefone no jogo deve ter de 1 a 6 dígitos.");
  return clean;
}

export function validateCouponCode(value: string, required = true) {
  const clean = value.trim().toUpperCase();
  if (!clean && !required) return "";
  if (!/^[A-Z0-9_-]{3,24}$/.test(clean)) {
    throw new Error("O cupom deve ter de 3 a 24 caracteres, usando letras, números, _ ou -.");
  }
  return clean;
}

export function validateRaffleTitle(value: string) {
  const clean = value.trim();
  if (clean.length < 2 || clean.length > 100) throw new Error("O título da rifa deve ter de 2 a 100 caracteres.");
  return clean;
}

export function validateRaffleDescription(value: string) {
  const clean = value.trim();
  if (clean.length < 3 || clean.length > 2000) throw new Error("A descrição deve ter de 3 a 2.000 caracteres.");
  return clean;
}

export function validateRaffleDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Informe uma data válida.");
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error("Informe uma data válida.");
  return value;
}

export function validateImageUrl(value: string) {
  const clean = value.trim();
  if (!clean) return "";
  try {
    const url = new URL(clean);
    if (!IMAGE_PROTOCOLS.has(url.protocol)) throw new Error();
    return url.toString();
  } catch {
    throw new Error("Informe uma URL de imagem válida, começando com http:// ou https://.");
  }
}

export function normalizeNumbers(values: unknown, maximum = 500) {
  if (!Array.isArray(values)) return [];
  const numbers = [...new Set(values.map(Number))].filter((value) => Number.isSafeInteger(value) && value > 0);
  if (numbers.length > maximum) throw new Error(`Escolha no máximo ${maximum} números por compra.`);
  return numbers;
}

export function parsePositiveId(value: string | number | undefined) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
