import { requireUserScope } from "@/shared/auth/require-user-scope";
import { SleepPhoneFlow } from "@/modules/records/ui/sleep-phone-form";

export default async function SleepPhonePage() {
  const { timezone } = await requireUserScope();
  return <SleepPhoneFlow timezone={timezone} />;
}
