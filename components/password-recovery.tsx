"use client";

import { FormEvent, useState } from "react";
import { AuthLayout, SecretField } from "./auth-layout";

export function PasswordRecovery() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = event.currentTarget;
    const values = new FormData(form);
    if (values.get("newPassword") !== values.get("confirmPassword")) {
      setError("As novas senhas não coincidem.");
      setBusy(false);
      return;
    }
    try {
      const response = await fetch("/api/account/recover-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: values.get("username"),
          playerId: values.get("playerId"),
          recoveryCode: values.get("recoveryCode"),
          newPassword: values.get("newPassword"),
          confirmPassword: values.get("confirmPassword"),
        }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível trocar a senha.");
      form.reset();
      setSuccess(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível trocar a senha.");
    } finally { setBusy(false); }
  }

  return <AuthLayout>
    <span className="auth-eyebrow">RECUPERE SEU ACESSO</span><h1>Esqueceu a senha?</h1><p className="auth-description">Informe os dados da conta e use sua chave para definir uma nova senha.</p>
    {success ? <div className="auth-success" role="status"><h2>Senha alterada!</h2><p>Você já pode entrar usando a nova senha.</p><a className="auth-submit" href="/conta">Entrar como membro →</a><a className="auth-secondary" href="/admin">Entrar no painel</a></div> : <form onSubmit={submit}>
      <label className="auth-field">Nome de usuário<input name="username" required minLength={3} maxLength={24} autoComplete="username" placeholder="Digite seu usuário" /></label>
      <label className="auth-field">ID no jogo<input name="playerId" maxLength={50} placeholder="Digite seu ID no Legacy" /><small>Deixe vazio somente se sua conta não tiver ID.</small></label>
      <SecretField label="Chave de recuperação" name="recoveryCode" required minLength={8} maxLength={64} autoComplete="off" placeholder="Chave criada no cadastro" />
      <SecretField label="Nova senha" name="newPassword" required minLength={8} maxLength={128} autoComplete="new-password" placeholder="Mínimo de 8 caracteres" />
      <SecretField label="Confirmar nova senha" name="confirmPassword" required minLength={8} maxLength={128} autoComplete="new-password" placeholder="Repita sua nova senha" />
      {error && <div className="auth-error" role="alert">{error}</div>}
      <button className="auth-submit" disabled={busy}>{busy ? "Trocando..." : "Redefinir senha"}<span aria-hidden="true">→</span></button>
    </form>}
    <div className="auth-support"><a href="/conta">← Login de membro</a><span> · </span><a href="/admin">Login da equipe</a></div>
  </AuthLayout>;
}
