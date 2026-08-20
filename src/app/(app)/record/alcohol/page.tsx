import { requireUserScope } from "@/shared/auth/require-user-scope";
import { AlcoholFlow } from "@/modules/records/ui/alcohol-flow";

export default async function AlcoholPage() {
  const { timezone } = await requireUserScope();
  return <AlcoholFlow timezone={timezone} />;
}
