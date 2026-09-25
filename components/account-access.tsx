"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthLayout, SecretField } from "./auth-layout";

export function AccountAccess() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    if (mode === "register" && form.get("password") !== form.get("confirmPassword")) {
      setError("As senhas não coincidem."); setBusy(false); return;
    }
    if (mode === "register" && form.get("password") === form.get("recoveryCode")) {
      setError("Crie uma chave de recuperação diferente da senha."); setBusy(false); return;
    }
    try {
      const response = await fetch(mode === "login" ? "/api/account/login" : "/api/account/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: form.get("username"),
          password: form.get("password"),
          playerId: form.get("playerId"),
          recoveryCode: form.get("recoveryCode"),
        }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível continuar.");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível continuar.");
    } finally { setBusy(false); }
  }

  function changeMode(next: "login" | "register") { setMode(next); setError(""); }

  return <AuthLayout>
    <div className="auth-tabs" aria-label="Acesso à conta">
      <button type="button" disabled={busy} aria-pressed={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => changeMode("login")}>Entrar</button>
      <button type="button" disabled={busy} aria-pressed={mode === "register"} className={mode === "register" ? "active" : ""} onClick={() => changeMode("register")}>Criar conta</button>
    </div>
    <span className="auth-eyebrow">{mode === "login" ? "BOM TER VOCÊ DE VOLTA" : "FAÇA PARTE DA RIFA.GG"}</span>
    <h1>{mode === "login" ? "Entre na sua conta" : "Crie sua conta"}</h1>
    <p className="auth-description">{mode === "login" ? "Seus números e compras em um só lugar." : "Permitimos uma conta por IP. Registramos o IP do cadastro para evitar contas repetidas. Se você compartilha a conexão, fale com o suporte."}</p>
    <form key={mode} onSubmit={submit}>
      <label className="auth-field">Nome de usuário<input name="username" required minLength={3} maxLength={24} autoComplete="username" placeholder="Digite seu usuário" /></label>
      {mode === "register" && <label className="auth-field">ID no jogo<input name="playerId" required maxLength={50} placeholder="Digite seu ID no Legacy" /></label>}
      <SecretField name="password" label="Senha" required minLength={8} maxLength={128} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder={mode === "login" ? "Digite sua senha" : "Mínimo de 8 caracteres"} />
      {mode === "register" && <>
        <SecretField name="confirmPassword" label="Confirmar senha" required minLength={8} maxLength={128} autoComplete="new-password" placeholder="Repita sua senha" />
        <SecretField name="recoveryCode" label="Criar chave de recuperação" required minLength={8} maxLength={64} autoComplete="off" placeholder="Crie uma chave diferente da senha" hint="Use de 8 a 64 caracteres. Guarde esta chave em um lugar seguro: você precisará dela se esquecer sua senha." />
      </>}
      {mode === "login" && <div className="auth-options"><a href="/recuperar-senha">Esqueci minha senha</a></div>}
      {error && <div className="auth-error" role="alert">{error}</div>}
      <button className="auth-submit" disabled={busy}>{busy ? "Aguarde..." : mode === "login" ? "Entrar na minha conta" : "Criar minha conta"}<span aria-hidden="true">→</span></button>
      {mode === "login" && <p className="auth-switch">Ainda não tem uma conta? <button type="button" disabled={busy} onClick={() => changeMode("register")}>Cadastre-se</button></p>}
    </form>
    <div className="auth-support">Precisa de ajuda? <a href="https://discord.gg/RUDWNwdyTV" target="_blank" rel="noopener noreferrer">Fale com a equipe ↗</a></div>
  </AuthLayout>;
}
