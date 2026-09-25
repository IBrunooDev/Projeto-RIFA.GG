"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { TERMS_OF_USE, TERMS_VERSION } from "@/lib/terms";

type Raffle = { id: number; title: string; description: string; price: number; originalPrice?: number | null; totalNumbers: number; drawingDate: string; imageUrl?: string | null };
type NumberItem = { number: number; status: "available" | "reserved" | "sold" };
type Winner = { id: number; title?: string; winnerNumber?: number | null; winnerName?: string | null; winnerGameId?: string | null };
type PublicData = { raffle: Raffle | null; numbers: NumberItem[]; winners: Winner[]; previousWinner: Winner | null };
type Account = { id: string; username: string; playerId?: string | null };
type CouponPreview = { code: string; discountPercent: number; subtotal: number; discountValue: number; total: number };

export function PublicRaffle() {
  const [data, setData] = useState<PublicData>({ raffle: null, numbers: [], winners: [], previousWinner: null });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number[]>([]);
  const [checkout, setCheckout] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState<CouponPreview | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/raffles/active", { cache: "no-store" });
      const payload = await response.json() as PublicData & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Falha ao carregar.");
      setData(payload);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao carregar a rifa."); }
    finally { if (!silent) setLoading(false); }
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { if (!document.hidden) void load(true); }, 10000);
    void fetch("/api/account/session", { cache: "no-store" }).then((response) => response.json()).then((payload: { account?: Account | null }) => setAccount(payload.account ?? null)).catch(() => setAccount(null));
    return () => window.clearInterval(timer);
  }, []);
  const numberMap = useMemo(() => new Map(data.numbers.map((item) => [item.number, item.status])), [data.numbers]);
  const filled = data.numbers.filter((item) => item.status !== "available").length;
  const progress = data.raffle ? Math.round((filled / data.raffle.totalNumbers) * 100) : 0;
  const discount = data.raffle ? getDiscountPercent(data.raffle.originalPrice, data.raffle.price) : null;

  useEffect(() => {
    setSelected([]);
    setCheckout(false);
    setCouponCode("");
    setCoupon(null);
    setTermsAccepted(false);
  }, [data.raffle?.id]);

  useEffect(() => {
    const available = selected.filter((number) => numberMap.get(number) === "available");
    if (available.length !== selected.length) {
      setSelected(available);
      setCoupon(null);
    }
  }, [numberMap, selected]);

  function toggleNumber(number: number) {
    if (numberMap.get(number) !== "available") return;
    setCoupon(null);
    setSelected((current) => current.includes(number) ? current.filter((item) => item !== number) : [...current, number].sort((a, b) => a - b));
  }

  async function applyCoupon() {
    if (!data.raffle || !selected.length) return;
    setCouponBusy(true); setMessage(""); setCoupon(null);
    try {
      const response = await fetch("/api/coupons/validate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: couponCode, raffleId: data.raffle.id, numberCount: selected.length }) });
      const payload = await response.json() as CouponPreview & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Cupom inválido.");
      setCoupon(payload); setCouponCode(payload.code); setMessage(`Cupom ${payload.code} aplicado: ${payload.discountPercent}% de desconto.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Cupom inválido."); }
    finally { setCouponBusy(false); }
  }

  async function reserve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data.raffle || !selected.length) return;
    const form = new FormData(event.currentTarget);
    setSending(true); setMessage("");
    try {
      const response = await fetch("/api/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ raffleId: data.raffle.id, buyerName: form.get("buyerName"), buyerGameId: form.get("buyerGameId"), buyerPhone: form.get("buyerPhone"), numbers: selected, couponCode: coupon?.code ?? null, termsAccepted, termsVersion: TERMS_VERSION }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível reservar.");
      setMessage("Reserva enviada! Aguarde a aprovação do gerente.");
      setSelected([]); setCheckout(false); setCouponCode(""); setCoupon(null); setTermsAccepted(false); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível reservar."); await load(true); }
    finally { setSending(false); }
  }

  return (
    <main className="public-shell">
      <header className="site-header"><a className="logo" href="#topo"><span>R</span>Rifa.GG<span className="brand-wolf"><img src="/rifagg-wolf.png" alt="" aria-hidden="true" /></span></a><nav><a href="https://discord.gg/RUDWNwdyTV" className="discord-nav-button" target="_blank" rel="noopener noreferrer" aria-label="Entrar no Discord da Rifa.GG"><i />Discord</a><a href="#rifa">Rifa</a><a href="#como-funciona">Como funciona</a><a href="/conta" className="account-link">{account ? `@${account.username}` : "Minha conta"}</a><a href="/admin" className="outline-button">Painel</a></nav></header>

      <section className="intro" id="topo">
        <div className="intro-copy"><span className="kicker">RIFA DENTRO DO JOGO</span><h1>Escolha seus números.<br /><em>Acompanhe com clareza.</em></h1><p>O pagamento é confirmado pelo gerente dentro do jogo. Nenhum dinheiro real é processado neste site.</p><a href="#rifa" className="primary-button">Ver rifa ativa</a></div>
        <PrizeWinnerArt />
      </section>

      <section className="content-section" id="rifa">
        {loading ? <div className="empty-card">Carregando rifa...</div> : !data.raffle ? <div className="empty-card"><strong>Nenhuma rifa ativa</strong><span>O gerente ainda não publicou a primeira rifa.</span></div> : (
          <article className="raffle-layout">
            <div className="prize-card">
              <div className="prize-image">{data.raffle.imageUrl ? <img src={data.raffle.imageUrl} alt={data.raffle.title} /> : <div className="image-placeholder">Rifa.GG</div>}</div>
              <span className="kicker">RIFA #{String(data.raffle.id).padStart(4, "0")}</span><h2>{data.raffle.title}</h2><p>{data.raffle.description}</p>
              <div className="prize-meta"><div className="raffle-price"><small>VALOR</small>{discount && <del>{data.raffle.originalPrice?.toLocaleString("pt-BR")}</del>}<strong>{data.raffle.price.toLocaleString("pt-BR")}</strong>{discount && <span className="discount-badge">-{discount}% OFF</span>}</div><div><small>SORTEIO</small><strong>{formatDate(data.raffle.drawingDate)}</strong></div></div>
              <div className="progress-label"><span>{filled} de {data.raffle.totalNumbers} preenchidos</span><strong>{progress}%</strong></div><div className="progress"><i style={{ width: `${progress}%` }} /></div>
            </div>

            <div className="numbers-card"><div className="card-heading"><div><span className="kicker">SELECIONE</span><h2>Escolha seus números</h2></div><div className="legend"><span><i className="free" /> Livre</span><span><i className="reserved" /> Reservado</span><span><i className="sold" /> Vendido</span></div></div>
              <div className="number-grid">{Array.from({ length: data.raffle.totalNumbers }, (_, index) => index + 1).map((number) => { const status = numberMap.get(number) ?? "available"; const isSelected = selected.includes(number); return <button key={number} disabled={status !== "available"} className={`number-button ${status} ${isSelected ? "selected" : ""}`} onClick={() => toggleNumber(number)}>{String(number).padStart(2, "0")}</button>; })}</div>
              <div className="selection-box"><div><small>SELECIONADOS</small><strong>{selected.length ? selected.map((number) => String(number).padStart(2, "0")).join(", ") : "Nenhum"}</strong></div><div><small>VALOR TOTAL</small><strong>{(selected.length * data.raffle.price).toLocaleString("pt-BR")}</strong></div><button className="primary-button" disabled={!selected.length} onClick={() => { if (account) { setTermsAccepted(false); setCheckout(true); } else { window.location.assign("/conta"); } }}>{account ? "Reservar" : "Entrar para reservar"}</button></div>
            </div>
          </article>
        )}
      </section>

      <section className="steps-section" id="como-funciona"><span className="kicker">COMO FUNCIONA</span><h2>Direto ao ponto</h2><div className="steps-grid"><article><b>01</b><strong>Escolha</strong><p>Selecione os números disponíveis.</p></article><article><b>02</b><strong>Identifique-se</strong><p>Informe seu nome, ID e telefone no jogo.</p></article><article><b>03</b><strong>Aguarde</strong><p>O gerente confirma a compra.</p></article><article><b>04</b><strong>Resultado</strong><p>O vencedor fica registrado no site.</p></article></div></section>

      <section className="public-results" id="resultados"><div className="public-results-head"><div><span className="kicker">RESULTADOS OFICIAIS</span><h2>Vencedores das rifas</h2><p>Os resultados ficam registrados aqui para toda a comunidade.</p></div><span className="public-live"><i /> ATUALIZAÇÃO AUTOMÁTICA</span></div>
        {data.winners.length ? <div className="public-winner-grid">{data.winners.map((winner) => <article key={winner.id}><div className="public-winner-number"><small>NÚMERO</small><strong>{String(winner.winnerNumber).padStart(2, "0")}</strong></div><div><small>VENCEDOR</small><strong>{winner.winnerName}</strong><span>ID no jogo: {winner.winnerGameId || "não informado"}</span></div><div><small>RIFA</small><strong>{winner.title || `Rifa #${String(winner.id).padStart(4, "0")}`}</strong><span>#{String(winner.id).padStart(4, "0")}</span></div></article>)}</div> : <div className="public-results-empty"><strong>Nenhum resultado publicado ainda</strong><span>O primeiro vencedor aparecerá aqui assim que uma rifa for sorteada.</span></div>}
      </section>
      {message && <div className="toast" onClick={() => setMessage("")}>{message}</div>}

      {checkout && data.raffle && <div className="modal-backdrop" role="presentation" onMouseDown={() => setCheckout(false)}><form className="modal checkout-modal" onSubmit={reserve} onMouseDown={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={() => setCheckout(false)} aria-label="Fechar">×</button><span className="kicker">FINALIZAR</span><h2>Solicitar reserva</h2><p>O gerente vai confirmar o valor dentro do jogo.</p><label>Nome no jogo<input name="buyerName" required minLength={2} maxLength={50} defaultValue={account?.username} placeholder="Ex.: NoxPlayer" /></label><label>ID do jogador<input name="buyerGameId" required maxLength={50} defaultValue={account?.playerId ?? ""} placeholder="Ex.: 88214" /></label><label>Telefone no jogo<input name="buyerPhone" required inputMode="numeric" pattern="[0-9]{1,6}" maxLength={6} autoComplete="off" placeholder="Ex.: 123456" /><small>Digite somente números, no máximo 6 dígitos.</small></label><label>Código de desconto<div className="coupon-entry"><input value={couponCode} onChange={(event) => { setCouponCode(event.target.value.toUpperCase()); setCoupon(null); }} minLength={3} maxLength={24} autoComplete="off" placeholder="Ex.: PROMO10" /><button type="button" disabled={couponBusy || !couponCode.trim()} onClick={() => void applyCoupon()}>{couponBusy ? "Verificando..." : "Aplicar"}</button></div>{coupon && <small className="coupon-success">Cupom {coupon.code}: {coupon.discountPercent}% de desconto aplicado.</small>}</label><div className="modal-summary"><span>Números</span><strong>{selected.join(", ")}</strong>{coupon && <><span>Subtotal</span><strong>{coupon.subtotal.toLocaleString("pt-BR")}</strong><span>Desconto ({coupon.discountPercent}%)</span><strong>-{coupon.discountValue.toLocaleString("pt-BR")}</strong></>}<span>Valor total</span><strong>{(coupon?.total ?? selected.length * data.raffle.price).toLocaleString("pt-BR")}</strong></div><section className="terms-box" aria-labelledby="terms-title"><strong id="terms-title">Termos de Uso — RIFA.GG</strong><p>Ao participar, você declara estar de acordo com as seguintes regras:</p><ul>{TERMS_OF_USE.map((term) => <li key={term}>{term}</li>)}</ul></section><label className="terms-acceptance"><input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} required /><span><strong>Li e aceito os Termos de Uso da RIFA.GG.</strong> Estou ciente de que a rifa e o prêmio são exclusivamente virtuais e não envolvem dinheiro real.</span></label><small className={`terms-status ${termsAccepted ? "accepted" : ""}`}>{termsAccepted ? "Termos aceitos. Você pode enviar a reserva." : "Aceite os termos para liberar o envio da reserva."}</small><button className="primary-button" disabled={sending || !termsAccepted}>{sending ? "Enviando..." : "Enviar para aprovação"}</button></form></div>}

      <footer><a className="logo" href="#topo"><span>R</span>Rifa.GG<span className="brand-wolf"><img src="/rifagg-wolf.png" alt="" aria-hidden="true" /></span></a><p>Sistema completo desenvolvido por <strong>IBrunooDev</strong>. Todos os direitos reservados.</p></footer>
    </main>
  );
}

function formatDate(value: string) { return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`)); }
function getDiscountPercent(originalPrice: number | null | undefined, price: number) { return originalPrice && originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : null; }

function PrizeWinnerArt() {
  return <div className="hero-prize" aria-hidden="true">
    <div className="hero-prize-grid" />
    <span className="hero-prize-label">PRÊMIO CONQUISTADO</span>
    <svg viewBox="0 0 520 410" role="presentation">
      <defs><linearGradient id="winnerGlow" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#d4ff83" /><stop offset="1" stopColor="#8cdf19" /></linearGradient></defs>
      <circle cx="260" cy="202" r="154" className="hero-orbit" />
      <circle cx="260" cy="202" r="112" className="hero-orbit hero-orbit-small" />
      <path className="hero-confetti" d="M76 105l18 10M102 66l4 22M421 93l-18 11M398 52l-5 23M65 245l22-4M445 242l-22-3" />
      <g className="hero-ball"><circle cx="78" cy="172" r="27" /><text x="78" y="178">07</text></g>
      <g className="hero-ball"><circle cx="432" cy="175" r="27" /><text x="432" y="181">23</text></g>
      <g className="hero-ball hero-ball-muted"><circle cx="394" cy="316" r="23" /><text x="394" y="321">41</text></g>
      <path className="hero-podium" d="M129 351h262l32 41H97z" />
      <path className="hero-person-body" d="M173 337c5-78 22-118 87-118s82 40 87 118z" />
      <circle className="hero-person-head" cx="260" cy="178" r="43" />
      <path className="hero-face" d="M245 177h1M276 177h1M250 195c7 7 14 7 21 0" />
      <path className="hero-arm" d="M191 267c-39-19-53-56-41-93M329 267c39-19 53-56 41-93" />
      <circle className="hero-hand" cx="149" cy="164" r="13" /><circle className="hero-hand" cx="371" cy="164" r="13" />
      <g className="hero-trophy">
        <path d="M213 62h94v34c0 48-25 70-47 70s-47-22-47-70z" />
        <path d="M214 75h-30c0 42 19 57 48 57M306 75h30c0 42-19 57-48 57" />
        <path d="M260 164v34M228 202h64" />
        <path className="hero-star" d="M260 82l7 14 16 2-12 11 3 16-14-8-14 8 3-16-12-11 16-2z" />
      </g>
    </svg>
    <div className="hero-prize-result"><span>RESULTADO REGISTRADO</span><strong>Jogador vencedor</strong><i>✓</i></div>
  </div>;
}
