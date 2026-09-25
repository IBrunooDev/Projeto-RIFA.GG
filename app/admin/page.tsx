import { getActiveAdmin } from "@/lib/admin";
import { AdminLogin } from "@/components/admin-login";
import { AdminPanel } from "@/components/admin-panel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getActiveAdmin();
  return session ? <AdminPanel currentAdmin={session} discordConfigured={Boolean(process.env.DISCORD_WEBHOOK_URL)} /> : <AdminLogin />;
}
