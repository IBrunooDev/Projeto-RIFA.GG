import { supabaseApi } from "@/lib/supabase";

export type LoginSecurity = {
  login_failed_attempts: number;
  login_locked_until: string | null;
};

export function isLoginLocked(account: LoginSecurity) {
  return Boolean(account.login_locked_until && new Date(account.login_locked_until).getTime() > Date.now());
}

export async function recordLoginFailure(accountId: string) {
  return supabaseApi<{ locked: boolean; lockedUntil: string | null }>("/rest/v1/rpc/record_login_failure", {
    method: "POST",
    body: JSON.stringify({ p_account_id: accountId }),
  });
}

export async function clearLoginFailures(accountId: string) {
  await supabaseApi("/rest/v1/rpc/clear_login_failures", {
    method: "POST",
    body: JSON.stringify({ p_account_id: accountId }),
  });
}
