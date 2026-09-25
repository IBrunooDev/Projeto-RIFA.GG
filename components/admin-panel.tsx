"use client";

import { FormEvent, useCallback, useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import type { AccountSession } from "@/lib/auth";

type Raffle = { id: number; title: string; price: number; originalPrice?: number | null; totalNumbers: number; drawingDate: string; status: string; imageUrl: string | null; sold: number; reserved: number; winnerNumber?: number | null; winnerName?: string | null; winnerGameId?: string | null; winnerPhone?: string | null };
type Purchase = { id: string; raffleId: number; raffleTitle: string; buyerName: string; buyerGameId: string; buyerPhone: string | null; numbers: number[]; subtotalValue: number; totalValue: number; discountPercent: number; couponCode: string | null; status: string; createdAt: string; reviewedAt: string | null; reviewedBy: string | null; reviewedById: string | null };
type Coupon = { id: string; code: string; discountPercent: number; minNumbers: number; raffleId: number | null; raffleTitle: string | null; maxUses: number | null; usedCount: number; expiresAt: string | null; active: boolean; createdBy: string; createdAt: string };
type UserRole = "owner" | "admin" | "sponsor" | "member";
type User = { id: string; username: string; playerId: string | null; phone: string | null; role: UserRole; active: boolean; createdAt: string };
type Overview = { raffles: Raffle[]; purchases: Purchase[]; stats: { active: number; pending: number; soldNumbers: number; players: number } };
type RaffleStatistics = { sold: number; reserved: number; free: number; totalNumbers: number; totalConfirmed: number; dailySales: { date: string; count: number }[]; freeNumbers: number[] };
type Tab = "overview" | "raffles" | "purchases" | "coupons" | "users" | "integrations";
type IconName = "overview" | "ticket" | "clock" | "users" | "plug" | "external" | "logout" | "refresh" | "plus" | "menu" | "sold" | "shield" | "close" | "chevron" | "trophy";

const empty: Overview = { raffles: [], purchases: [], stats: { active: 0, pending: 0, soldNumbers: 0, players: 0 } };
const pageMeta: Record<Tab, { kicker: string; title: string; subtitle: string }> = {
  overview: { kicker: "ADMINISTRAÇÃO", title: "Central de rifas", subtitle: "Acompanhe prêmios, jogadores, números e resultados em um só lugar." },
  raffles: { kicker: "GERENCIAMENTO", title: "Suas rifas", subtitle: "Crie rifas, ajuste valores, registre compradores e realize sorteios." },
  purchases: { kicker: "PAGAMENTOS", title: "Aprovações", subtitle: "Confira as moedas recebidas antes de aprovar cada reserva." },
  coupons: { kicker: "PROMOÇÕES", title: "Cupons de desconto", subtitle: "Crie códigos para divulgar e acompanhe quantas vezes foram usados." },
  users: { kicker: "CONTAS E ACESSOS", title: "Usuários", subtitle: "Gerencie membros, gerentes, senhas e permissões." },
  integrations: { kicker: "CONFIGURAÇÕES", title: "Integrações", subtitle: "Veja o estado dos serviços usados pela sua plataforma." },
};

export function AdminPanel({ currentAdmin, discordConfigured = false }: { currentAdmin: AccountSession; discordConfigured?: boolean }) {
  const router = useRouter();
  const [data, setData] = useState<Overview>(empty);
  const [users, setUsers] = useState<User[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("");
  const [savedCredentials, setSavedCredentials] = useState<{ username: string; password: string; recoveryCode: string } | null>(null);
  const [userError, setUserError] = useState("");
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [createCouponOpen, setCreateCouponOpen] = useState(false);
  const [editCoupon, setEditCoupon] = useState<Coupon | null>(null);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editRaffle, setEditRaffle] = useState<Raffle | null>(null);
  const [statsRaffleId, setStatsRaffleId] = useState<number | null>(null);
  const [raffleStatistics, setRaffleStatistics] = useState<RaffleStatistics | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState("");
  const [saleRaffle, setSaleRaffle] = useState<Raffle | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const isOwner = currentAdmin.role === "owner";
  const canSupport = currentAdmin.role === "owner" || currentAdmin.role === "admin";
  const visibleUsers = users.filter((user) => (!userRoleFilter || user.role === userRoleFilter) && (user.username.toLocaleLowerCase("pt-BR").includes(userSearch.trim().toLocaleLowerCase("pt-BR")) || (user.playerId ?? "").includes(userSearch.trim())));
  const isSponsor = currentAdmin.role === "sponsor";
  const canRunRaffle = currentAdmin.role === "owner" || currentAdmin.role === "admin";

  const load = useCallback(async () => {
    try {
      const overviewResponse = await fetch("/api/admin/overview", { cache: "no-store" });
      const overview = await overviewResponse.json() as Overview & { error?: string };
      if (!overviewResponse.ok) throw new Error(overview.error || "Falha ao carregar o painel.");
      setData(overview);
      const couponResponse = await fetch("/api/admin/coupons", { cache: "no-store" });
      const couponPayload = await couponResponse.json() as { coupons?: Coupon[]; error?: string };
      if (!couponResponse.ok) throw new Error(couponPayload.error || "Falha ao carregar cupons.");
      setCoupons(couponPayload.coupons ?? []);
      if (currentAdmin.role === "owner" || currentAdmin.role === "admin") {
        const usersResponse = await fetch("/api/admin/users", { cache: "no-store" });
        const userPayload = await usersResponse.json() as { users?: User[]; error?: string };
        if (!usersResponse.ok) throw new Error(userPayload.error || "Falha ao carregar usuários.");
        setUsers(userPayload.users ?? []);
      } else setUsers([]);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao carregar o painel."); }
    finally { setLoading(false); }
  }, [currentAdmin.role]);

  const loadRaffleStatistics = useCallback(async (raffleId: number) => {
    setStatsLoading(true);
    try {
      const response = await fetch(`/api/admin/raffles/${raffleId}/stats`, { cache: "no-store" });
      const payload = await response.json() as RaffleStatistics & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Falha ao carregar as estatísticas.");
      setRaffleStatistics(payload);
      setStatsError("");
    } catch (error) {
      setStatsError(error instanceof Error ? error.message : "Falha ao carregar as estatísticas.");
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 5000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!statsRaffleId) {
      setRaffleStatistics(null);
      setStatsError("");
      return;
    }
    void loadRaffleStatistics(statsRaffleId);
    const timer = window.setInterval(() => { if (!document.hidden) void loadRaffleStatistics(statsRaffleId); }, 10000);
    return () => window.clearInterval(timer);
  }, [loadRaffleStatistics, statsRaffleId]);

  function navigate(next: Tab) {
    if (next === "users" && !canSupport) return;
    if (next === "integrations" && isSponsor) return;
    setTab(next); setMenuOpen(false);
  }

  async function createRaffle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); const form = event.currentTarget;
    try {
      const response = await fetch("/api/admin/raffles", { method: "POST", body: new FormData(form) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível criar.");
      form.reset(); setCreateOpen(false); setMessage("Rifa criada com sucesso."); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível criar."); }
    finally { setBusy(false); }
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); const form = event.currentTarget; const values = new FormData(form);
    try {
      const response = await fetch("/api/admin/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: values.get("username"), playerId: values.get("playerId"), password: values.get("password"), recoveryCode: values.get("recoveryCode"), role: values.get("role") }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível criar a conta.");
      form.reset(); setCreateUserOpen(false); setMessage("Conta criada com sucesso."); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível criar a conta."); }
    finally { setBusy(false); }
  }

  async function createCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); const form = event.currentTarget; const values = new FormData(form);
    try {
      const response = await fetch("/api/admin/coupons", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: values.get("code"), discountPercent: Number(values.get("discountPercent")), minNumbers: Number(values.get("minNumbers")), raffleId: values.get("raffleId") ? Number(values.get("raffleId")) : null, maxUses: values.get("maxUses") ? Number(values.get("maxUses")) : null, expiresAt: values.get("expiresAt") || null }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível criar o cupom.");
      form.reset(); setCreateCouponOpen(false); setMessage("Cupom criado e pronto para divulgação."); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível criar o cupom."); }
    finally { setBusy(false); }
  }

  async function updateCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editCoupon) return; setBusy(true); setMessage(""); const values = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/admin/coupons/${editCoupon.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ discountPercent: Number(values.get("discountPercent")), minNumbers: Number(values.get("minNumbers")) }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível editar o cupom.");
      setEditCoupon(null); setMessage(`Cupom ${editCoupon.code} atualizado.`); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível editar o cupom."); }
    finally { setBusy(false); }
  }

  async function toggleCoupon(coupon: Coupon) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/coupons/${coupon.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ active: !coupon.active }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível alterar o cupom.");
      setMessage(coupon.active ? `Cupom ${coupon.code} desativado.` : `Cupom ${coupon.code} ativado.`); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível alterar o cupom."); }
    finally { setBusy(false); }
  }

  async function deleteCoupon(coupon: Coupon) {
    if (!window.confirm(`Excluir definitivamente o cupom “${coupon.code}”? As compras antigas manterão o desconto registrado.`)) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/coupons/${coupon.id}`, { method: "DELETE" });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível excluir o cupom.");
      setMessage(`Cupom ${coupon.code} excluído.`); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível excluir o cupom."); }
    finally { setBusy(false); }
  }

  async function updateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editUser || busy) return;
    setBusy(true); setMessage(""); setUserError("");
    const form = event.currentTarget;
    const values = new FormData(form);
    const password = String(values.get("password") ?? "");
    const recoveryCode = String(values.get("recoveryCode") ?? "");
    try {
      const response = await fetch(`/api/admin/users/${editUser.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: values.get("username"), playerId: values.get("playerId"), phone: values.get("phone"), password, recoveryCode, ...(isOwner ? { role: values.get("role") ?? editUser.role, active: editUser.id === currentAdmin.id ? true : values.get("active") === "on" } : {}) }) });
      const payload = await response.json() as { error?: string; user?: User };
      if (!response.ok) throw new Error(payload.error || "Não foi possível salvar.");
      const username = payload.user?.username ?? String(values.get("username"));
      form.reset(); setEditUser(null);
      if (password || recoveryCode) setSavedCredentials({ username, password, recoveryCode });
      setMessage("Alterações salvas."); await load();
      if (editUser.id === currentAdmin.id) router.refresh();
    } catch (error) { setUserError(error instanceof Error ? error.message : "Não foi possível salvar."); }
    finally { setBusy(false); }
  }

  async function toggleUser(user: User) {
    if (user.id === currentAdmin.id) { setMessage("Você não pode bloquear sua própria conta administrativa."); return; }
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: user.username, playerId: user.playerId, active: !user.active }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível alterar a conta.");
      setMessage(user.active ? "Conta bloqueada." : "Conta reativada."); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível alterar a conta."); }
    finally { setBusy(false); }
  }

  async function changeUserRole(user: User, nextRole: UserRole) {
    if (!isOwner || user.id === currentAdmin.id) { setMessage("Você não pode alterar o cargo da sua própria conta."); return; }
    if (user.role === nextRole) return;
    if (!window.confirm(`Alterar o cargo de “${user.username}” para ${roleLabel(nextRole)}?`)) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: user.username, playerId: user.playerId, active: user.active, role: nextRole }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível alterar o acesso.");
      setMessage(`${user.username} agora tem o cargo ${roleLabel(nextRole)}.`); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível alterar o acesso."); }
    finally { setBusy(false); }
  }

  async function deleteUser(user: User) {
    if (!isOwner || user.id === currentAdmin.id) { setMessage("Você não pode excluir sua própria conta de Dono."); return; }
    if (!window.confirm(`Excluir definitivamente a conta “${user.username}”? Esta ação não pode ser desfeita.`)) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível excluir a conta.");
      setMessage(`A conta ${user.username} foi excluída.`); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível excluir a conta."); }
    finally { setBusy(false); }
  }

  async function resetRaffle(raffle: Raffle) {
    if (!isOwner) { setMessage("Somente o Dono pode resetar rifas."); return; }
    if (!window.confirm(`Resetar a rifa “${raffle.title}”? Compras, números vendidos e vencedor serão apagados.`)) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/raffles/${raffle.id}/reset`, { method: "POST" });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível resetar a rifa.");
      setMessage(`A rifa ${raffle.title} foi resetada e está ativa novamente.`); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível resetar a rifa."); }
    finally { setBusy(false); }
  }

  async function updateRaffle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editRaffle) return; setBusy(true); setMessage(""); const form = event.currentTarget;
    try {
      const response = await fetch(`/api/admin/raffles/${editRaffle.id}`, { method: "PATCH", body: new FormData(form) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível editar a rifa.");
      setEditRaffle(null); setMessage("Nome, foto, valor e data atualizados com sucesso."); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível editar a rifa."); }
    finally { setBusy(false); }
  }

  async function deleteRaffle(raffle: Raffle) {
    if (!isOwner) { setMessage("Somente o Dono pode excluir rifas."); return; }
    if (!window.confirm(`Excluir definitivamente a rifa “${raffle.title}”? Compras, números e vencedor também serão apagados.`)) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/raffles/${raffle.id}`, { method: "DELETE" });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível excluir a rifa.");
      setMessage(`A rifa ${raffle.title} foi excluída definitivamente.`); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível excluir a rifa."); }
    finally { setBusy(false); }
  }

  async function registerSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!saleRaffle) return; setBusy(true); setMessage(""); const values = new FormData(event.currentTarget);
    const numbers = String(values.get("numbers") ?? "").split(/[\s,;]+/).map(Number).filter(Number.isInteger);
    try {
      const response = await fetch(`/api/admin/raffles/${saleRaffle.id}/sales`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ buyerName: values.get("buyerName"), buyerGameId: values.get("buyerGameId"), buyerPhone: values.get("buyerPhone"), numbers }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível registrar.");
      setSaleRaffle(null); setMessage("Compra registrada e números incluídos no sorteio."); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível registrar."); }
    finally { setBusy(false); }
  }

  async function review(id: string, action: "approve" | "reject") {
    const purchase = data.purchases.find((item) => item.id === id);
    const actionLabel = action === "approve" ? "aprovar" : "recusar";
    if (purchase && !window.confirm(`Deseja ${actionLabel} a compra de ${purchase.buyerName} na rifa “${purchase.raffleTitle}”?`)) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/purchases/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível revisar.");
      setMessage(action === "approve" ? "Compra aprovada." : "Compra recusada e números liberados."); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível revisar."); }
    finally { setBusy(false); }
  }

  async function draw(raffle: Raffle) {
    if (!window.confirm(`Sortear um vencedor da rifa “${raffle.title}”?`)) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/raffles/${raffle.id}/draw`, { method: "POST" });
      const payload = await response.json() as { winner?: { name: string; number: number }; discordSent?: boolean; error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível sortear.");
      setMessage(`Vencedor: ${payload.winner?.name}, número ${payload.winner?.number}${payload.discordSent ? " — enviado ao Discord" : ""}.`); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível sortear."); }
    finally { setBusy(false); }
  }

  async function testWebhook() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/webhook/test", { method: "POST" });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível enviar o teste.");
      setMessage("Teste enviado ao Discord. Nenhuma rifa real foi criada.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível enviar o teste."); }
    finally { setBusy(false); }
  }

  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); router.refresh(); }

  const pending = data.purchases.filter((item) => item.status === "pending");
  const reviewed = data.purchases.filter((item) => item.status === "approved" || item.status === "rejected");
  const winners = data.raffles.filter((item) => item.status === "completed" && item.winnerNumber && item.winnerName);
  const statsRaffle = data.raffles.find((item) => item.id === statsRaffleId) ?? null;
  const meta = pageMeta[tab];

  function raffleRows(items: Raffle[]) {
    return items.map((raffle) => {
      const progress = Math.min(100, Math.round(((raffle.sold + raffle.reserved) / raffle.totalNumbers) * 100));
      const discount = getDiscountPercent(raffle.originalPrice, raffle.price);
      return <tr key={raffle.id}>
        <td><strong>#{String(raffle.id).padStart(4, "0")}</strong><small>{raffle.title}</small></td><td><Status value={raffle.status} /></td>
        <td><div className="admin-progress-copy"><strong>{raffle.sold}/{raffle.totalNumbers}</strong><small>{raffle.reserved} reservados</small><div className="admin-mini-progress"><i style={{ width: `${progress}%` }} /></div></div></td>
        <td><div className="admin-price">{discount && <del>{raffle.originalPrice?.toLocaleString("pt-BR")} moedas</del>}<strong>{raffle.price.toLocaleString("pt-BR")} moedas</strong>{discount && <span>-{discount}% OFF</span>}</div></td><td>{formatDate(raffle.drawingDate)}</td>
        <td><div className="admin-row-actions"><button className="table-action" type="button" onClick={() => setStatsRaffleId(raffle.id)}>Gráfico</button>{canRunRaffle && raffle.status === "active" && <button className="table-action" disabled={busy} onClick={() => setSaleRaffle(raffle)}>Registrar</button>}{canRunRaffle && raffle.status === "active" && <button className="table-action primary" disabled={raffle.sold === 0 || busy} onClick={() => void draw(raffle)}>Sortear</button>}<details className="action-menu"><summary aria-label={`Mais ações para ${raffle.title}`}>•••</summary><div>{["active", "draft"].includes(raffle.status) && <button disabled={busy} onClick={() => setEditRaffle(raffle)}>Editar rifa</button>}{isOwner && <button disabled={busy} onClick={() => void resetRaffle(raffle)}>Resetar rifa</button>}{isOwner && <button className="danger" disabled={busy} onClick={() => void deleteRaffle(raffle)}>Excluir definitivamente</button>}</div></details></div></td>
      </tr>;
    });
  }

  return <main className="admin-shell">
    {menuOpen && <button className="admin-sidebar-overlay" aria-label="Fechar menu" onClick={() => setMenuOpen(false)} />}
    <aside className={`admin-sidebar ${menuOpen ? "open" : ""}`}>
      <div className="admin-sidebar-brand"><a className="logo" href="/"><span>R</span>Rifa.GG<span className="brand-wolf"><img src="/rifagg-wolf.png" alt="" aria-hidden="true" /></span></a><button className="admin-sidebar-close" onClick={() => setMenuOpen(false)} aria-label="Fechar menu"><Icon name="close" /></button></div>
      <span className="admin-nav-label">PAINEL DE CONTROLE</span>
      <nav className="admin-sidebar-nav"><NavButton active={tab === "overview"} icon="overview" label="Visão geral" onClick={() => navigate("overview")} /><NavButton active={tab === "raffles"} icon="ticket" label="Rifas" count={data.raffles.length} onClick={() => navigate("raffles")} /><NavButton active={tab === "purchases"} icon="clock" label="Aprovações" count={pending.length} highlightCount onClick={() => navigate("purchases")} /><NavButton active={tab === "coupons"} icon="sold" label="Cupons" count={coupons.filter((coupon) => coupon.active).length} onClick={() => navigate("coupons")} />{canSupport && <NavButton active={tab === "users"} icon="users" label="Usuários" count={users.length} onClick={() => navigate("users")} />}{!isSponsor && <NavButton active={tab === "integrations"} icon="plug" label="Integrações" onClick={() => navigate("integrations")} />}</nav>
      <span className="admin-nav-label secondary">ATALHOS</span>
      <nav className="admin-sidebar-nav"><a href="/" target="_blank" rel="noreferrer"><Icon name="external" /><span>Ver site público</span></a><a href="/conta" target="_blank" rel="noreferrer"><Icon name="users" /><span>Área de membro</span></a></nav>
      <div className="admin-sidebar-user"><div className="admin-avatar">{currentAdmin.username.charAt(0).toUpperCase()}</div><div><strong>{currentAdmin.username}</strong><span>{roleLabel(currentAdmin.role)}</span></div><button onClick={logout} aria-label="Sair"><Icon name="logout" /></button></div>
    </aside>

    <section className="admin-main">
      <header className="admin-mobile-header"><button onClick={() => setMenuOpen(true)} aria-label="Abrir menu"><Icon name="menu" /></button><a className="logo" href="/"><span>R</span>Rifa.GG<span className="brand-wolf"><img src="/rifagg-wolf.png" alt="" aria-hidden="true" /></span></a><span className={`role-badge ${currentAdmin.role}`}>{roleLabel(currentAdmin.role)}</span></header>
      <div className="admin-main-inner">
        <div className="admin-page-heading"><div><span className="kicker">{meta.kicker}</span><h1>{meta.title}</h1><p>{meta.subtitle}</p></div><div className="admin-heading-actions"><button className="admin-refresh" disabled={loading} onClick={() => void load()}><Icon name="refresh" /> Atualizar</button>{(tab === "overview" || tab === "raffles") && <button className="primary-button" onClick={() => setCreateOpen(true)}><Icon name="plus" /> Nova rifa</button>}{tab === "coupons" && <button className="primary-button" onClick={() => setCreateCouponOpen(true)}><Icon name="plus" /> Novo cupom</button>}{tab === "users" && isOwner && <button className="primary-button" onClick={() => setCreateUserOpen(true)}><Icon name="plus" /> Novo usuário</button>}</div></div>

        {loading ? <DashboardLoading /> : <>
          {tab === "overview" && <><section className="admin-stats-grid"><Stat icon="ticket" tone="lime" label="Rifas ativas" value={data.stats.active} /><Stat icon="clock" tone="yellow" label="Aguardando aprovação" value={data.stats.pending} /><Stat icon="sold" tone="cyan" label="Números vendidos" value={data.stats.soldNumbers} /><Stat icon="users" tone="purple" label="Jogadores únicos" value={data.stats.players} /></section>
            <section className="admin-dashboard-grid"><div className="admin-panel-card wide"><PanelHeader title="Suas rifas" subtitle="Acompanhe o preenchimento e use as ações rápidas." action={<button onClick={() => navigate("raffles")}>Ver todas <Icon name="chevron" /></button>} /><div className="table-scroll"><table className="admin-table"><thead><tr><th>Rifa</th><th>Status</th><th>Progresso</th><th>Valor</th><th>Data</th><th>Ações</th></tr></thead><tbody>{raffleRows(data.raffles.slice(0, 5))}{!data.raffles.length && <EmptyRow columns={6} text="Nenhuma rifa criada." />}</tbody></table></div></div>
              <div className="admin-panel-card compact"><PanelHeader title="Aprovações recentes" subtitle={`${pending.length} compra${pending.length === 1 ? "" : "s"} aguardando`} action={<button onClick={() => navigate("purchases")}>Abrir fila <Icon name="chevron" /></button>} /><div className="approval-preview">{pending.slice(0, 4).map((purchase) => <article key={purchase.id}><div className="approval-avatar">{purchase.buyerName.charAt(0).toUpperCase()}</div><div><strong>{purchase.buyerName}</strong><span>{purchase.raffleTitle} · ID {purchase.buyerGameId} · Tel. {purchase.buyerPhone || "—"} · {purchase.numbers.length} número{purchase.numbers.length === 1 ? "" : "s"}{purchase.couponCode ? ` · Cupom ${purchase.couponCode}` : ""}</span></div><b>{purchase.totalValue.toLocaleString("pt-BR")}</b></article>)}{!pending.length && <div className="compact-empty"><Icon name="shield" /><strong>Tudo em dia</strong><span>Nenhuma compra aguardando aprovação.</span></div>}</div></div></section><WinnerSection winners={winners} /></>}

          {tab === "raffles" && <section className="admin-panel-card"><PanelHeader title="Todas as rifas" subtitle={`${data.raffles.length} rifa${data.raffles.length === 1 ? " cadastrada" : "s cadastradas"}. O vencedor sempre é escolhido aleatoriamente.`} /><div className="table-scroll"><table className="admin-table"><thead><tr><th>Rifa</th><th>Status</th><th>Progresso</th><th>Valor</th><th>Data</th><th>Ações</th></tr></thead><tbody>{raffleRows(data.raffles)}{!data.raffles.length && <EmptyRow columns={6} text="Nenhuma rifa criada." />}</tbody></table></div></section>}

          {tab === "purchases" && <><section className="admin-panel-card"><PanelHeader title="Fila de aprovação" subtitle="Aprove somente depois de confirmar o pagamento dentro do jogo." /><div className="table-scroll"><table className="admin-table"><thead><tr><th>Jogador</th><th>Rifa</th><th>ID</th><th>Telefone</th><th>Números</th><th>Total</th><th>Data</th><th>Decisão</th></tr></thead><tbody>{pending.map((purchase) => <tr key={purchase.id}><td><strong>{purchase.buyerName}</strong></td><td><strong>{purchase.raffleTitle}</strong></td><td>#{purchase.buyerGameId}</td><td>{purchase.buyerPhone || "—"}</td><td><span className="number-list">{purchase.numbers.join(", ")}</span></td><td><strong>{purchase.totalValue.toLocaleString("pt-BR")}</strong><small>{purchase.couponCode ? `Cupom ${purchase.couponCode} · -${purchase.discountPercent}%` : "moedas"}</small></td><td>{formatDate(purchase.createdAt)}</td><td><div className="admin-row-actions"><button className="table-action reject" disabled={busy} onClick={() => void review(purchase.id, "reject")}>Recusar</button><button className="table-action primary" disabled={busy} onClick={() => void review(purchase.id, "approve")}>Aprovar</button></div></td></tr>)}{!pending.length && <EmptyRow columns={8} text="Nenhuma compra aguardando aprovação." />}</tbody></table></div></section><section className="admin-panel-card decision-history"><PanelHeader title="Histórico de decisões" subtitle="Registro de segurança de quem aprovou ou recusou cada compra." /><div className="table-scroll"><table className="admin-table"><thead><tr><th>Jogador</th><th>Compra</th><th>Decisão</th><th>Responsável</th><th>Data e hora</th></tr></thead><tbody>{reviewed.map((purchase) => <tr key={purchase.id}><td><strong>{purchase.buyerName}</strong><small>ID {purchase.buyerGameId} · Tel. {purchase.buyerPhone || "—"}</small></td><td><strong>{purchase.raffleTitle}</strong><small>Números {purchase.numbers.join(", ")}{purchase.couponCode ? ` · Cupom ${purchase.couponCode}` : ""}</small></td><td><Status value={purchase.status} /></td><td><strong>{purchase.reviewedBy || "Registro antigo"}</strong><small>{purchase.reviewedById ? `Conta ${purchase.reviewedById.slice(0, 8)}` : "Sem ID registrado"}</small></td><td>{purchase.reviewedAt ? formatDateTime(purchase.reviewedAt) : "—"}</td></tr>)}{!reviewed.length && <EmptyRow columns={5} text="Nenhuma decisão registrada ainda." />}</tbody></table></div></section></>}

          {tab === "coupons" && <section className="admin-panel-card"><PanelHeader title="Códigos divulgados" subtitle="Cada conta pode usar o mesmo código uma vez. Compras recusadas liberam o cupom para novo uso." /><div className="table-scroll"><table className="admin-table"><thead><tr><th>Código</th><th>Desconto</th><th>Mínimo</th><th>Rifa</th><th>Usos</th><th>Validade</th><th>Status</th><th>Ações</th></tr></thead><tbody>{coupons.map((coupon) => <tr key={coupon.id}><td><strong className="coupon-code">{coupon.code}</strong><small>Criado por {coupon.createdBy}</small></td><td><strong>{coupon.discountPercent}%</strong></td><td><strong>{coupon.minNumbers}</strong><small>número{coupon.minNumbers === 1 ? "" : "s"}</small></td><td>{coupon.raffleTitle || "Todas as rifas"}</td><td><strong>{coupon.usedCount}{coupon.maxUses ? `/${coupon.maxUses}` : ""}</strong><small>{coupon.maxUses ? "limite total" : "sem limite"}</small></td><td>{coupon.expiresAt ? formatDateTime(coupon.expiresAt) : "Sem validade"}</td><td><span className={`status ${coupon.active ? "active" : "blocked"}`}>{coupon.active ? "Ativo" : "Desativado"}</span></td><td><div className="admin-row-actions"><button className="table-action" disabled={busy} onClick={() => setEditCoupon(coupon)}>Editar</button><button className={`table-action ${coupon.active ? "reject" : "primary"}`} disabled={busy} onClick={() => void toggleCoupon(coupon)}>{coupon.active ? "Desativar" : "Ativar"}</button><button className="table-action reject" disabled={busy} onClick={() => void deleteCoupon(coupon)}>Excluir</button></div></td></tr>)}{!coupons.length && <EmptyRow columns={8} text="Nenhum cupom criado ainda." />}</tbody></table></div></section>}

          {tab === "users" && canSupport && <section className="admin-panel-card"><PanelHeader title="Contas e permissões" subtitle="Dono e Gerente prestam suporte. Somente o Dono gerencia cargos." /><div className="user-search-bar"><label>Pesquisar conta<input type="search" value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Nome de usuário ou ID no jogo" /></label><label>Cargo<select value={userRoleFilter} onChange={(event) => setUserRoleFilter(event.target.value)}><option value="">Todos os cargos</option><option value="owner">Dono</option><option value="admin">Gerente</option><option value="sponsor">Patrocinador</option><option value="member">Membro</option></select></label><p aria-live="polite">{visibleUsers.length} conta(s) encontrada(s)</p></div><div className="table-scroll"><table className="admin-table"><thead><tr><th>Usuário</th><th>ID no jogo</th><th>Cargo</th><th>Status</th><th>Criado em</th><th>Ações</th></tr></thead><tbody>{visibleUsers.map((user) => { const canChange = isOwner && user.id !== currentAdmin.id; return <tr key={user.id}><td><strong>{user.username}{user.id === currentAdmin.id ? " (você)" : ""}</strong></td><td>{user.playerId || "—"}</td><td><span className={`role-badge ${user.role}`}>{roleLabel(user.role)}</span></td><td><span className={`status ${user.active ? "active" : "blocked"}`}>{user.active ? "Ativo" : "Bloqueado"}</span></td><td>{formatDate(user.createdAt)}</td><td><div className="admin-row-actions"><button className="table-action" disabled={!isOwner && user.role === "owner"} title={!isOwner && user.role === "owner" ? "Somente o Dono pode editar esta conta" : undefined} onClick={() => { setUserError(""); setEditUser(user); }}>Editar</button>{canChange && <details className="action-menu"><summary aria-label={`Mais ações para ${user.username}`}>•••</summary><div>{user.role !== "owner" && <button disabled={busy} onClick={() => void changeUserRole(user, "owner")}>Aplicar cargo Dono</button>}{user.role !== "sponsor" && <button disabled={busy} onClick={() => void changeUserRole(user, "sponsor")}>Aplicar Patrocinador</button>}{user.role !== "admin" && <button disabled={busy} onClick={() => void changeUserRole(user, "admin")}>Aplicar Gerente</button>}{user.role !== "member" && <button disabled={busy} onClick={() => void changeUserRole(user, "member")}>Tornar Membro</button>}<button disabled={busy} onClick={() => void toggleUser(user)}>{user.active ? "Bloquear conta" : "Reativar conta"}</button><button className="danger" disabled={busy} onClick={() => void deleteUser(user)}>Excluir conta</button></div></details>}</div></td></tr>; })}{!visibleUsers.length && <EmptyRow columns={6} text="Nenhuma conta encontrada." />}</tbody></table></div></section>}

          {tab === "integrations" && !isSponsor && <section className="integration-grid"><IntegrationCard iconClass="discord" status={discordConfigured ? "CONECTADO" : "NÃO CONFIGURADO"} connected={discordConfigured} title="Discord" description="Envia automaticamente o nome, ID, telefone no jogo e número do vencedor para o canal configurado." noteTitle={discordConfigured ? "Webhook ativo" : "Configure na Vercel"} note={discordConfigured ? "Envie uma simulação sem criar rifa ou alterar o banco." : "Adicione DISCORD_WEBHOOK_URL nas variáveis de ambiente."} action={<button className="integration-test-button" type="button" disabled={busy || !discordConfigured} onClick={() => void testWebhook()}>{busy ? "Enviando..." : "Enviar mensagem de teste"}</button>} /><IntegrationCard iconClass="database" status="CONECTADO" connected title="Supabase" description="Armazena contas, rifas, compras, números, resultados e imagens com acesso protegido." noteTitle="Banco operacional" note="O painel conseguiu carregar os dados normalmente." /><IntegrationCard iconClass="security" status="PROTEGIDO" connected title="Sessões e cargos" description="Uma conta de Membro não pode compartilhar a sessão do painel administrativo." noteTitle="Acesso separado" note="Dono, Gerente, Patrocinador e Membro são verificados novamente no banco." /></section>}
        </>}
      </div>
    </section>

    {message && <div className="toast admin-toast" onClick={() => setMessage("")}><span>{message}</span><button aria-label="Fechar"><Icon name="close" /></button></div>}
    {createOpen && <Modal onClose={() => setCreateOpen(false)}><form onSubmit={createRaffle}><span className="kicker">NOVA RIFA</span><h2>Criar rifa</h2><p>A nova rifa ficará ativa automaticamente e a atual irá para rascunho.</p><label>Título<input name="title" required minLength={2} maxLength={100} placeholder="Ex.: Kit Lendário" /></label><label>Descrição<textarea name="description" required minLength={3} maxLength={2000} placeholder="Descreva o prêmio e a entrega." /></label><div className="form-grid"><label>Valor por número<input name="price" type="number" min="1" step="1" required placeholder="5000" /></label><label>Quantidade<input name="totalNumbers" type="number" min="10" max="500" defaultValue="100" required /></label></div><div className="form-grid"><label>Data do sorteio<input name="drawingDate" type="date" required /></label><label>URL da imagem<input name="imageUrl" type="url" placeholder="https://..." /></label></div><label>Ou envie uma imagem<input name="image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" /></label><div className="modal-actions"><button type="button" onClick={() => setCreateOpen(false)}>Cancelar</button><button className="primary-button" disabled={busy}>{busy ? "Criando..." : "Criar rifa"}</button></div></form></Modal>}
    {createCouponOpen && <Modal compact onClose={() => setCreateCouponOpen(false)}><form onSubmit={createCoupon}>
      <div className="support-modal-heading"><div><span className="kicker">NOVO CUPOM</span><h2>Gerar código de desconto</h2></div></div>
      <div className="support-form-grid">
        <label>Código<input name="code" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_-]{3,24}" autoCapitalize="characters" placeholder="Ex.: PROMO20" /></label>
        <label>Aplicar em<select name="raffleId" defaultValue=""><option value="">Todas as rifas</option>{data.raffles.filter((raffle) => raffle.status === "active" || raffle.status === "draft").map((raffle) => <option key={raffle.id} value={raffle.id}>{raffle.title} (#{String(raffle.id).padStart(4, "0")})</option>)}</select></label>
        <label>Desconto em %<input name="discountPercent" type="number" min="1" max="100" step="1" required placeholder="20" /></label>
        <label>Quantidade mínima<input name="minNumbers" type="number" min="1" max="500" step="1" required defaultValue="1" /><small>Números necessários para usar o cupom.</small></label>
        <label>Limite total de usos · opcional<input name="maxUses" type="number" min="1" step="1" placeholder="Vazio = sem limite" /></label>
        <label>Validade · opcional<input name="expiresAt" type="datetime-local" /><small>Vazio = sem prazo para expirar.</small></label>
      </div>
      <p className="support-form-hint">Divulgue o código depois de salvar. Cada conta poderá utilizá-lo uma vez.</p>
      <div className="modal-actions"><button type="button" onClick={() => setCreateCouponOpen(false)}>Cancelar</button><button className="primary-button" disabled={busy}>{busy ? "Gerando..." : "Gerar cupom"}</button></div>
    </form></Modal>}
    {editCoupon && <Modal compact onClose={() => setEditCoupon(null)}><form onSubmit={updateCoupon}><div className="support-modal-heading"><div><span className="kicker">EDITAR CUPOM</span><h2>{editCoupon.code}</h2></div></div><div className="support-form-grid"><label>Desconto em %<input name="discountPercent" type="number" min="1" max="100" step="1" required defaultValue={editCoupon.discountPercent} /></label><label>Quantidade mínima de números<input name="minNumbers" type="number" min="1" max="500" step="1" required defaultValue={editCoupon.minNumbers} /></label></div><p className="support-form-hint">Altere o desconto e a quantidade mínima exigida na compra.</p><div className="modal-actions"><button type="button" onClick={() => setEditCoupon(null)}>Cancelar</button><button className="primary-button" disabled={busy}>{busy ? "Salvando..." : "Salvar alterações"}</button></div></form></Modal>}
    {statsRaffle && <Modal wide onClose={() => setStatsRaffleId(null)}><RaffleStats raffle={statsRaffle} statistics={raffleStatistics} loading={statsLoading} error={statsError} onRetry={() => void loadRaffleStatistics(statsRaffle.id)} /></Modal>}
    {editRaffle && <Modal onClose={() => setEditRaffle(null)}><form onSubmit={updateRaffle}><span className="kicker">DADOS DA RIFA</span><h2>Editar rifa</h2><p>Altere somente o nome, a foto, o valor ou a data.</p><label>Nome da rifa<input name="title" required minLength={2} maxLength={100} defaultValue={editRaffle.title} autoFocus /></label><label>Novo valor por número<input name="price" type="number" min="1" step="1" required defaultValue={editRaffle.price} /><small>O novo valor vale para as próximas compras. As compras já registradas mantêm o total original.</small></label><label>Data do sorteio<input name="drawingDate" type="date" required defaultValue={editRaffle.drawingDate} /></label><label>URL da foto<input name="imageUrl" type="url" defaultValue={editRaffle.imageUrl ?? ""} placeholder="https://..." /></label><label>Ou envie uma nova foto<input name="image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" /><small>A nova foto pode ter no máximo 5 MB.</small></label><div className="modal-actions"><button type="button" onClick={() => setEditRaffle(null)}>Cancelar</button><button className="primary-button" disabled={busy}>{busy ? "Salvando..." : "Salvar alterações"}</button></div></form></Modal>}
    {saleRaffle && <Modal onClose={() => setSaleRaffle(null)}><form onSubmit={registerSale}><span className="kicker">COMPRA MANUAL</span><h2>Registrar comprador</h2><p>{saleRaffle.title}</p><label>Nome do jogador<input name="buyerName" required minLength={2} maxLength={50} placeholder="Ex.: NoxPlayer" /></label><label>ID dentro do jogo<input name="buyerGameId" required maxLength={50} placeholder="Ex.: 88214" /></label><label>Telefone no jogo<input name="buyerPhone" required inputMode="numeric" pattern="[0-9]{1,6}" maxLength={6} autoComplete="off" placeholder="Ex.: 123456" /><small>Somente números, no máximo 6 dígitos.</small></label><label>Números<input name="numbers" required maxLength={2000} placeholder="Ex.: 7, 18, 42" /><small>Separe os números por vírgula ou espaço.</small></label><div className="modal-actions"><button type="button" onClick={() => setSaleRaffle(null)}>Cancelar</button><button className="primary-button" disabled={busy}>{busy ? "Salvando..." : "Confirmar compra"}</button></div></form></Modal>}
    {createUserOpen && <Modal onClose={() => setCreateUserOpen(false)}><form onSubmit={createUser}><span className="kicker">NOVA CONTA</span><h2>Criar usuário</h2><p>Defina o cargo e entregue a senha e a chave de recuperação ao usuário.</p><label>Usuário<input name="username" required minLength={3} maxLength={24} placeholder="Ex.: noxplayer" /></label><label>ID dentro do jogo<input name="playerId" required maxLength={50} placeholder="Ex.: 88214" /></label><label>Tipo de acesso<select name="role" defaultValue="member"><option value="member">Membro — participa das rifas</option><option value="sponsor">Patrocinador — cria rifas e aprova compras</option><option value="admin">Gerente — gerencia rifas e sorteios</option><option value="owner">Dono — acesso total</option></select></label><label>Senha inicial<input name="password" type="password" required minLength={8} maxLength={128} placeholder="Mínimo de 8 caracteres" /></label><label>Chave de recuperação<input name="recoveryCode" type="password" required minLength={8} maxLength={64} placeholder="Mínimo de 8 caracteres" /></label><div className="modal-actions"><button type="button" onClick={() => setCreateUserOpen(false)}>Cancelar</button><button className="primary-button" disabled={busy}>{busy ? "Criando..." : "Criar conta"}</button></div></form></Modal>}
    {savedCredentials && canSupport && <Modal onClose={() => setSavedCredentials(null)}><span className="kicker">ALTERAÇÕES SALVAS</span><h2>{savedCredentials.username}</h2><p>Copie os novos dados antes de fechar. Os valores anteriores não são exibidos.</p>{savedCredentials.password && <SavedSecret label="Nova senha" value={savedCredentials.password} />}{savedCredentials.recoveryCode && <SavedSecret label="Nova chave de recuperação" value={savedCredentials.recoveryCode} />}<div className="modal-actions"><button className="primary-button" onClick={() => setSavedCredentials(null)}>Concluir e ocultar</button></div></Modal>}
    {editUser && canSupport && <Modal compact onClose={() => { if (!busy) setEditUser(null); }}><form onSubmit={updateUser}>
      <div className="support-modal-heading"><div><span className="kicker">SUPORTE · DONO E Gerente</span><h2>Editar · {editUser.username}</h2></div><span className={`status ${editUser.active ? "active" : "blocked"}`}>{editUser.active ? "Ativo" : "Bloqueado"}</span></div>
      {userError && <p className="user-support-error" role="alert">{userError}</p>}
      <div className="support-form-grid">
        <label>Nome de usuário<input name="username" required minLength={3} maxLength={24} defaultValue={editUser.username} autoComplete="off" /></label>
        <label>ID no jogo<input name="playerId" maxLength={50} defaultValue={editUser.playerId ?? ""} placeholder="ID no jogo" /></label>
        <label>Nova senha · opcional<input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} placeholder="Deixe vazio para manter" /></label>
        <label>Nova chave de recuperação · opcional<input name="recoveryCode" type="password" autoComplete="off" minLength={8} maxLength={64} placeholder="Deixe vazio para manter" /></label>
      </div>
      {isOwner && <label className="support-role">Cargo · somente o Dono<select name="role" defaultValue={editUser.role} disabled={editUser.id === currentAdmin.id}><option value="member">Membro</option><option value="sponsor">Patrocinador</option><option value="admin">Gerente</option><option value="owner">Dono</option></select>{editUser.id === currentAdmin.id && <small>Você não pode alterar o próprio cargo.</small>}</label>}
      <details className="support-extra"><summary>Mais opções da conta</summary><label>Telefone no jogo<input name="phone" inputMode="numeric" pattern="[0-9]{1,6}" maxLength={6} defaultValue={editUser.phone ?? ""} autoComplete="off" placeholder="Até 6 números" /></label>{isOwner && <label className="checkbox-label"><input name="active" type="checkbox" defaultChecked={editUser.active} disabled={editUser.id === currentAdmin.id} /><span>Conta ativa</span></label>}</details>
      <p className="support-form-hint">Preencha somente o que deseja mudar e salve uma vez.</p>
      <div className="modal-actions"><button type="button" disabled={busy} onClick={() => setEditUser(null)}>Cancelar</button><button className="primary-button" disabled={busy}>{busy ? "Salvando..." : "Salvar alterações"}</button></div>
    </form></Modal>}
  </main>;
}

function NavButton({ active, icon, label, count, highlightCount, onClick }: { active: boolean; icon: IconName; label: string; count?: number; highlightCount?: boolean; onClick: () => void }) { return <button className={active ? "active" : ""} onClick={onClick}><Icon name={icon} /><span>{label}</span>{typeof count === "number" && <i className={highlightCount && count > 0 ? "highlight" : ""}>{count}</i>}</button>; }
function Stat({ icon, tone, label, value }: { icon: IconName; tone: string; label: string; value: number }) { return <article className="admin-stat"><div className={`admin-stat-icon ${tone}`}><Icon name={icon} /></div><div><small>{label}</small><strong>{value}</strong></div></article>; }
function PanelHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) { return <div className="admin-panel-card-head"><div><h2>{title}</h2><p>{subtitle}</p></div>{action && <div className="panel-head-action">{action}</div>}</div>; }
function IntegrationCard({ iconClass, status, connected, title, description, noteTitle, note, action }: { iconClass: string; status: string; connected: boolean; title: string; description: string; noteTitle: string; note: string; action?: React.ReactNode }) { return <article className="integration-card"><div className={`integration-icon ${iconClass}`}><Icon name={iconClass === "security" ? "shield" : iconClass === "database" ? "sold" : "plug"} /></div><div><span className="integration-status"><i className={connected ? "connected" : "waiting"} />{status}</span><h2>{title}</h2><p>{description}</p></div><div className="integration-note"><strong>{noteTitle}</strong><span>{note}</span></div>{action && <div className="integration-action">{action}</div>}</article>; }
function RaffleStats({ raffle, statistics, loading, error, onRetry }: { raffle: Raffle; statistics: RaffleStatistics | null; loading: boolean; error: string; onRetry: () => void }) {
  const sold = Math.max(0, Math.min(statistics?.sold ?? raffle.sold, statistics?.totalNumbers ?? raffle.totalNumbers));
  const totalNumbers = Math.max(0, statistics?.totalNumbers ?? raffle.totalNumbers);
  const reserved = Math.max(0, Math.min(statistics?.reserved ?? raffle.reserved, totalNumbers - sold));
  const free = Math.max(0, statistics?.free ?? totalNumbers - sold - reserved);
  const occupied = sold + reserved;
  const occupiedPercent = totalNumbers > 0 ? Math.round((occupied / totalNumbers) * 100) : 0;
  const soldPercent = totalNumbers > 0 ? (sold / totalNumbers) * 100 : 0;
  const chartOccupiedPercent = totalNumbers > 0 ? (occupied / totalNumbers) * 100 : 0;
  const chartStyle = { "--sold-percent": `${soldPercent}%`, "--occupied-percent": `${chartOccupiedPercent}%` } as CSSProperties;
  const dailySales = statistics?.dailySales ?? [];
  const maxDailySales = Math.max(1, ...dailySales.map((day) => day.count));

  return <section className="raffle-stats">
    <span className="kicker">RIFA #{String(raffle.id).padStart(4, "0")}</span>
    <h2>{raffle.title}</h2>
    <p>Visão completa da movimentação desta rifa.</p>
    {error && <div className="raffle-stats-error"><span>{error}</span><button type="button" onClick={onRetry}>Tentar novamente</button></div>}
    {!statistics && loading ? <div className="raffle-stats-loading"><i /><i /><i /><i /><b /></div> : <>
      <div className="raffle-stats-cards">
        <article className="sold"><small>NÚMEROS VENDIDOS</small><strong>{sold}</strong><span>{totalNumbers ? `${Math.round((sold / totalNumbers) * 100)}% do total da rifa` : "Nenhum número"}</span></article>
        <article className="reserved"><small>RESERVADOS</small><strong>{reserved}</strong><span>Aguardando aprovação</span></article>
        <article className="free"><small>NÚMEROS LIVRES</small><strong>{free}</strong><span>Disponíveis para compra</span></article>
        <article className="confirmed"><small>TOTAL CONFIRMADO</small><strong>{formatCompactCoins(statistics?.totalConfirmed ?? 0)}</strong><span>moedas em vendas aprovadas</span></article>
      </div>
      <div className="raffle-stats-main">
        <article className="raffle-chart-card distribution">
          <header><strong>Distribuição dos números</strong><span>Resumo dos {totalNumbers} números da rifa.</span></header>
          <div className="raffle-distribution-body">
            <div className="raffle-stats-donut" style={chartStyle} role="img" aria-label={`${sold} números vendidos, ${reserved} reservados e ${free} livres`}><div><strong>{occupiedPercent}%</strong><span>ocupados</span></div></div>
            <div className="raffle-stats-legend"><div><i className="sold" /><span>Vendidos</span><strong>{sold}</strong></div><div><i className="reserved" /><span>Reservados</span><strong>{reserved}</strong></div><div><i className="free" /><span>Livres</span><strong>{free}</strong></div></div>
          </div>
        </article>
        <article className="raffle-chart-card sales">
          <header><strong>Vendas nos últimos 7 dias</strong><span>Quantidade de números aprovados por dia.</span></header>
          <div className="raffle-sales-bars" role="img" aria-label="Gráfico de vendas nos últimos sete dias">
            {dailySales.map((day) => <div className="raffle-sales-day" key={day.date} title={`${day.count} número${day.count === 1 ? "" : "s"} vendido${day.count === 1 ? "" : "s"}`}><div><i style={{ height: `${day.count === 0 ? 3 : Math.max(12, (day.count / maxDailySales) * 100)}%` }}><b>{day.count}</b></i></div><span>{formatChartDay(day.date)}</span></div>)}
            {!dailySales.length && <div className="raffle-sales-empty">Sem histórico de vendas.</div>}
          </div>
        </article>
      </div>
      <article className="raffle-free-card">
        <header><div><strong>Números livres</strong><span>Disponíveis para compra agora.</span></div><b>{free} disponíveis agora</b></header>
        {statistics?.freeNumbers.length ? <div className="raffle-free-grid">{statistics.freeNumbers.map((number) => <span key={number}>{String(number).padStart(2, "0")}</span>)}</div> : <div className="raffle-free-empty">{free === 0 ? "Todos os números já estão ocupados." : "Atualize o banco para visualizar a lista de números livres."}</div>}
      </article>
    </>}
  </section>;
}
function WinnerSection({ winners }: { winners: Raffle[] }) { return <section className="admin-winners"><div className="admin-winners-head"><div><span className="kicker">RESULTADOS</span><h2>Últimos vencedores</h2><p>Resultados atualizados automaticamente após cada sorteio.</p></div><span className="live-indicator"><i /> AO VIVO</span></div>{winners.length ? <div className="admin-winner-grid">{winners.slice(0, 6).map((winner) => <article key={winner.id}><div className="admin-winner-number"><small>NÚMERO</small><strong>{String(winner.winnerNumber).padStart(2, "0")}</strong></div><div><small>VENCEDOR</small><strong>{winner.winnerName}</strong><span>ID {winner.winnerGameId || "não informado"} · Tel. {winner.winnerPhone || "—"}</span></div><div><small>RIFA</small><strong>{winner.title}</strong><span>#{String(winner.id).padStart(4, "0")}</span></div></article>)}</div> : <div className="winner-empty"><Icon name="trophy" /><strong>Nenhum vencedor ainda</strong><span>Os resultados aparecerão aqui depois do primeiro sorteio.</span></div>}</section>; }
function roleLabel(role: UserRole) { return role === "owner" ? "Dono" : role === "admin" ? "Gerente" : role === "sponsor" ? "Patrocinador" : "Membro"; }
function EmptyRow({ columns, text }: { columns: number; text: string }) { return <tr><td colSpan={columns}><div className="table-empty">{text}</div></td></tr>; }
function DashboardLoading() { return <div className="admin-loading"><div className="loading-stats">{[1, 2, 3, 4].map((item) => <i key={item} />)}</div><div className="loading-panel" /></div>; }
function Status({ value }: { value: string }) { const labels: Record<string, string> = { active: "Ativa", draft: "Rascunho", completed: "Concluída", cancelled: "Cancelada", pending: "Aguardando", approved: "Aprovada", rejected: "Recusada" }; return <span className={`status ${value}`}>{labels[value] ?? value}</span>; }
function Modal({ children, onClose, wide = false, compact = false }: { children: React.ReactNode; onClose: () => void; wide?: boolean; compact?: boolean }) { return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><div className={`modal admin-modal ${wide ? "admin-modal-wide" : ""} ${compact ? "support-modal" : ""}`} role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={onClose} aria-label="Fechar"><Icon name="close" /></button>{children}</div></div>; }

function Icon({ name }: { name: IconName }) {
  const content: Record<IconName, React.ReactNode> = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    ticket: <><path d="M4 7a2 2 0 0 0 0 4v6h16v-6a2 2 0 0 0 0-4V5H4z" /><path d="M9 5v14M15 5v14" /></>, clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    users: <><path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 20v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>, plug: <><path d="M12 22v-5M9 8V2M15 8V2M18 8v3a6 6 0 0 1-12 0V8z" /></>,
    external: <><path d="M14 3h7v7M10 14 21 3" /><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" /></>, logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></>,
    refresh: <><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></>, plus: <path d="M12 5v14M5 12h14" />, menu: <path d="M4 7h16M4 12h16M4 17h16" />, sold: <><path d="M4 6h16v12H4z" /><path d="M8 10h8M8 14h5" /></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /><path d="m9 12 2 2 4-4" /></>, close: <path d="M6 6l12 12M18 6 6 18" />, chevron: <path d="m9 18 6-6-6-6" />, trophy: <><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0z" /><path d="M7 6H3v2a4 4 0 0 0 4 4M17 6h4v2a4 4 0 0 1-4 4" /></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{content[name]}</svg>;
}

function formatDate(value: string) { const date = new Date(value.includes("T") ? value : `${value}T12:00:00Z`); return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(date); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)); }
function formatChartDay(value: string) { const date = new Date(`${value}T12:00:00Z`); return new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", timeZone: "UTC" }).format(date).replace(".", ""); }
function formatCompactCoins(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (value >= 1_000) return `${(value / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return value.toLocaleString("pt-BR");
}
function getDiscountPercent(originalPrice: number | null | undefined, price: number) { return originalPrice && originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : null; }

function SavedSecret({ label, value }: { label: string; value: string }) {
  const [visible, setVisible] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(value); setCopied(true); setCopyError(false); }
    catch { setCopyError(true); }
  }
  return <div className="saved-secret"><label>{label}<input readOnly type={visible ? "text" : "password"} value={value} autoComplete="off" onFocus={(event) => event.currentTarget.select()} /></label><div className="modal-actions"><button type="button" onClick={() => void copy()}>{copied ? "Copiado!" : "Copiar"}</button><button type="button" onClick={() => setVisible(!visible)}>{visible ? "Ocultar" : "Mostrar"}</button></div>{copyError && <p role="status">Selecione o valor no campo e copie manualmente.</p>}</div>;
}
