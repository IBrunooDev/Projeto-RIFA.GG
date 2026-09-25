"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthLayout, SecretField } from "./auth-layout";

export function AdminLogin() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: form.get("username"), password: form.get("password") }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível entrar.");
      router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Não foi possível entrar."); }
    finally { setLoading(false); }
  }

  return <AuthLayout admin>
    <div className="auth-access"><span className="auth-shield" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/></svg></span><div><span className="auth-eyebrow">ACESSO ADMINISTRATIVO</span><p>Área da equipe</p></div></div>
    <h1>Entre no painel</h1><p className="auth-description">Use sua conta para acessar a administração.</p>
    <div className="auth-roles"><span>Dono</span><span>Gerente</span><span>Patrocinador</span></div>
    <form onSubmit={login}>
      <label className="auth-field">Nome de usuário<input name="username" required minLength={3} maxLength={24} autoComplete="username" placeholder="Digite seu usuário" /></label>
      <SecretField label="Senha" name="password" required minLength={8} maxLength={128} autoComplete="current-password" placeholder="Digite sua senha" />
      <div className="auth-options"><a href="/recuperar-senha">Esqueci minha senha</a></div>
      {error && <div className="auth-error" role="alert">{error}</div>}
      <button className="auth-submit" disabled={loading}>{loading ? "Entrando..." : "Acessar painel"}<span aria-hidden="true">→</span></button>
      <p className="auth-note">As opções do painel dependem do cargo da sua conta.</p>
    </form>
    <div className="auth-support">Quer participar das rifas? <a href="/conta">Área do membro ↗</a></div>
  </AuthLayout>;
}
