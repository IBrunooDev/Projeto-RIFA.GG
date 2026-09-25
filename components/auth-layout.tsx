"use client";

import { useState, type ReactNode, type InputHTMLAttributes } from "react";

export function AuthLayout({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  return <main className="auth-modern"><header className="auth-header"><a className="auth-brand" href="/"><b>R</b><strong>RIFA.GG</strong><img src="/auth-wolf.png" alt="Lobo RIFA.GG" /></a><a className="auth-back" href="/">← Voltar {admin ? "ao site" : "para a rifa"}</a></header><div className="auth-layout"><section className="auth-intro"><div><span className="auth-eyebrow">{admin ? "ADMINISTRAÇÃO • RIFA.GG" : "ÁREA DO MEMBRO"}</span><h2>{admin ? <>Sua equipe.<br />Suas rifas.<br /><em>Tudo no controle.</em></> : <>Seus números.<br />Sua próxima<br /><em>conquista.</em></>}</h2><p>{admin ? "Acompanhe as compras e gerencie suas rifas em um só lugar." : "Acesse sua conta e acompanhe suas participações nas rifas do servidor Legacy."}</p></div><img className="auth-feature-wolf" src="/auth-wolf.png" alt="Logo do lobo RIFA.GG" /><div className="auth-intro-foot"><span>GTA SA • LEGACY</span><span>Prêmios virtuais</span></div></section><section className="auth-form-area"><div className="auth-form-shell">{children}</div></section></div><footer className="auth-footer"><span>RIFA.GG • Servidor Legacy</span><span>Sistema completo desenvolvido pelo IBrunooDev. Todos os créditos reservados.</span></footer></main>;
}

export function SecretField({ label, hint, ...input }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const [visible, setVisible] = useState(false);
  return <div className="auth-field"><label htmlFor={`auth-${input.name}`}>{label}</label><div className="auth-secret"><input {...input} id={`auth-${input.name}`} type={visible ? "text" : "password"} /><button type="button" aria-label={`${visible ? "Ocultar" : "Mostrar"} ${label.toLowerCase()}`} aria-pressed={visible} onClick={() => setVisible(!visible)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />{visible && <path d="m3 3 18 18" />}</svg></button></div>{hint && <small>{hint}</small>}</div>;
}
