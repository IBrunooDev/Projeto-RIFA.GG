import { getAdminSession, getMemberSession, type AccountSession } from "@/lib/auth";
import { supabaseApi } from "@/lib/supabase";

type AccountRow = { id: string; username: string; player_id: string | null; role: "owner" | "admin" | "sponsor"; active: boolean; session_version: number };

export async function getActiveAdmin(): Promise<AccountSession | null> {
  if (await getMemberSession()) return null;
  const session = await getAdminSession();
  if (!session) return null;
  const accounts = await supabaseApi<AccountRow[]>(`/rest/v1/accounts?select=id,username,player_id,role,active,session_version&id=eq.${encodeURIComponent(session.id)}&role=in.(owner,admin,sponsor)&active=eq.true&limit=1`);
  const account = accounts[0];
  return account && account.session_version === session.sessionVersion ? { id: account.id, username: account.username, playerId: account.player_id, role: account.role, sessionVersion: account.session_version } : null;
}

export async function isActiveAdmin() { return Boolean(await getActiveAdmin()); }

export async function getActiveManager() {
  const account = await getActiveAdmin();
  return account && (account.role === "owner" || account.role === "admin") ? account : null;
}
