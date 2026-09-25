"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AccountSession } from "@/lib/auth";

type Purchase = {
  id: string;
  buyerName: string;
  buyerGameId: string;
  buyerPhone: string | null;
  numbers: number[];
  totalValue: number;
  subtotalValue: number;
  discountPercent: number;
  couponCode: string | null;
  status: string;
  createdAt: string;
  raffle: { title: string; status: string; winner_number: number | null } | null;
};

export function MemberArea({ account }: { account: AccountSession }) {
  const router = useRouter();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [purchasesLoading, setPurchasesLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [securityBusy, setSecurityBusy] = useState(false);

  useEffect(() => {
    void fetch("/api/account/purchases", { cache: "no-store" }).then(async (response) => {
      const payload = await response.json() as { purchases?: Purchase[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Falha ao carregar suas compras.");
      setPurchases(payload.purchases ?? []);
    }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Falha ao carregar suas compras.")).finally(() => setPurchasesLoading(false));
  }, []);

  async function logout() { await fetch("/api/account/logout", { method: "POST" }); router.refresh(); }

  async function updateRecoveryCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSecurityBusy(true);
    setMessage("");
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      const response = await fetch("/api/account/security", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword: values.get("currentPassword"), recoveryCode: values.get("recoveryCode") }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível salvar a chave.");
      form.reset();
      setMessage("Chave de recuperação atualizada. Guarde-a em um local seguro.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar a chave.");
    } finally { setSecurityBusy(false); }
  }

  return <main className="member-page">
    <header className="site-header"><a className="logo" href="/"><span>R</span>Rifa.GG<span className="brand-wolf"><img src="/rifagg-wolf.png" alt="" aria-hidden="true" /></span></a><nav><a href="/">Ver rifa</a><button className="outline-button" onClick={logout}>Sair</button></nav></header>
    <section className="member-content">
      <div className="member-heading"><div><span className="kicker">MINHA CONTA</span><h1>Olá, {account.username}</h1><p>ID no jogo: {account.playerId || "não informado"}</p></div><a className="primary-button" href="/">Escolher números</a></div>
      <section className="admin-card"><div className="admin-card-head"><div><h2>Minhas reservas</h2><p>Acompanhe aqui a aprovação e os números comprados.</p></div></div>
        <div className="table-scroll"><table><thead><tr><th>Rifa</th><th>Números</th><th>Valor</th><th>Data</th><th>Status</th></tr></thead><tbody>
          {purchases.map((purchase) => <tr key={purchase.id}><td><strong>{purchase.raffle?.title ?? "Rifa"}</strong><small>{purchase.buyerName} · ID {purchase.buyerGameId} · Tel. {purchase.buyerPhone || "—"}</small></td><td>{purchase.numbers.join(", ")}</td><td><strong>{purchase.totalValue.toLocaleString("pt-BR")}</strong>{purchase.couponCode && <small>Cupom {purchase.couponCode} · -{purchase.discountPercent}%</small>}</td><td>{formatDate(purchase.createdAt)}</td><td><Status value={purchase.status} /></td></tr>)}
          {purchasesLoading && <tr><td colSpan={5}><div className="table-empty">Carregando suas reservas...</div></td></tr>}
          {!purchasesLoading && !purchases.length && <tr><td colSpan={5}><div className="table-empty">Você ainda não reservou nenhum número.</div></td></tr>}
        </tbody></table></div>
      </section>
      <section className="security-card">
        <div><span className="kicker">SEGURANÇA</span><h2>Chave de recuperação</h2><p>Atualize a chave usada para trocar sua senha caso você esqueça. Ela precisa ter de 8 a 64 caracteres.</p></div>
        <form onSubmit={updateRecoveryCode}>
          <label>Senha atual<input name="currentPassword" type="password" required minLength={8} maxLength={128} autoComplete="current-password" placeholder="Confirme sua senha atual" /></label>
          <label>Nova chave de recuperação<input name="recoveryCode" type="password" required minLength={8} maxLength={64} autoComplete="off" placeholder="Crie uma chave fácil de guardar" /></label>
          <button className="primary-button" disabled={securityBusy}>{securityBusy ? "Salvando..." : "Salvar nova chave"}</button>
        </form>
      </section>
      {message && <div className="toast" onClick={() => setMessage("")}>{message}</div>}
    </section>
  </main>;
}

function Status({ value }: { value: string }) {
  const labels: Record<string, string> = { pending: "Aguardando", approved: "Aprovada", rejected: "Recusada" };
  return <span className={`status ${value}`}>{labels[value] ?? value}</span>;
}
function formatDate(value: string) { return new Intl.DateTimeFormat("pt-BR").format(new Date(value)); }
