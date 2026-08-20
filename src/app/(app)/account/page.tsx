import { getAccountViewModel } from "@/modules/account/application/get-account-view-model";
import { AccountScreen } from "@/modules/account/ui/account-screen";
import { requireSessionIdentity } from "@/shared/auth/require-session-user";
import { requireUserScope } from "@/shared/auth/require-user-scope";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const [scope, identity] = await Promise.all([requireUserScope(), requireSessionIdentity()]);
  if (scope.userId !== identity.userId) throw new Error("ACCOUNT_SESSION_SCOPE_MISMATCH");
  return <AccountScreen viewModel={await getAccountViewModel(scope, { identityEmail: identity.email })} />;
}
