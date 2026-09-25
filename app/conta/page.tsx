import { getActiveMember } from "@/lib/member";
import { AccountAccess } from "@/components/account-access";
import { MemberArea } from "@/components/member-area";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await getActiveMember();
  return session ? <MemberArea account={session} /> : <AccountAccess />;
}
