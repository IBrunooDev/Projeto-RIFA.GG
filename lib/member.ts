import { getAdminSession, getMemberSession, type AccountSession } from "@/lib/auth";
import { supabaseApi } from "@/lib/supabase";

type AccountRow = { id: string; username: string; player_id: string | null; role: "member"; active: boolean; session_version: number };

export async function getActiveMember(): Promise<AccountSession | null> {
  if (await getAdminSession()) return null;
  const session = await getMemberSession();
  if (!session) return null;
  const accounts = await supabaseApi<AccountRow[]>(`/rest/v1/accounts?select=id,username,player_id,role,active,session_version&id=eq.${encodeURIComponent(session.id)}&role=eq.member&active=eq.true&limit=1`);
  const account = accounts[0];
  return account && account.session_version === session.sessionVersion ? { id: account.id, username: account.username, playerId: account.player_id, role: "member", sessionVersion: account.session_version } : null;
}
