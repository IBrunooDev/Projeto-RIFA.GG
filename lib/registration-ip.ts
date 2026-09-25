import { isIP } from "node:net";

export function registrationIp(request: Request): string {
  // Trust forwarding headers only behind the Vercel ingress.
  if (process.env.VERCEL !== "1") {
    if (process.env.NODE_ENV === "development") return "127.0.0.1";
    throw new Error("Cadastro indisponível: a identificação de IP precisa da hospedagem Vercel.");
  }
  const ip = (request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for") ?? "").trim();
  if (!isIP(ip)) throw new Error("Não foi possível verificar sua conexão. Tente novamente ou fale com o suporte.");
  return ip;
}
