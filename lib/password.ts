import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

export const DUMMY_PASSWORD_HASH = "scrypt:4d1df6d5e02e387fc0ff54e7390b59aa:75f0eacbd8e777d2bd84a406a1f2bcb99ae4fc11177d6a3ad9fcaba185bdbee37506993d1452538aa21c41f95701638e3204d581b1346f72034cdda1d9146736";

export async function hashPassword(password: string) {
  validatePassword(password);
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  try {
    const [algorithm, salt, hash] = stored.split(":");
    if (algorithm !== "scrypt" || !salt || !hash) return false;
    const expected = Buffer.from(hash, "hex");
    const actual = await scrypt(password, salt, expected.length) as Buffer;
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch { return false; }
}

export function validateUsername(username: string) {
  if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(username)) throw new Error("O usuário deve ter de 3 a 24 caracteres e usar apenas letras, números, ponto, traço ou underline.");
}

export function validatePassword(password: string) {
  if (password.length < 8 || password.length > 128) throw new Error("A senha deve ter de 8 a 128 caracteres.");
}

export function validateRecoveryCode(code: string) {
  if (code.length < 8 || code.length > 64) {
    throw new Error("A chave de recuperação deve ter de 8 a 64 caracteres.");
  }
}
