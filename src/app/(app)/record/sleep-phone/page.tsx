import { requireUserScope } from "@/shared/auth/require-user-scope";
import { SleepPhoneFlow } from "@/modules/records/ui/sleep-phone-form";

type SleepPhonePageProps = Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>;

const firstParam = (value: string | string[] | undefined): string | undefined => Array.isArray(value) ? value[0] : value;

export default async function SleepPhonePage({ searchParams }: SleepPhonePageProps) {
  const { timezone } = await requireUserScope();
  const query = await searchParams;
  return <SleepPhoneFlow focus={firstParam(query.focus)} timezone={timezone} step={firstParam(query.step)} />;
}
