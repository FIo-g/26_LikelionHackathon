import { requireUserScope } from "@/shared/auth/require-user-scope";
import { CaffeineFlow } from "@/modules/records/ui/caffeine-flow";

export default async function CaffeinePage() {
  const { timezone } = await requireUserScope();
  return <CaffeineFlow timezone={timezone} />;
}
