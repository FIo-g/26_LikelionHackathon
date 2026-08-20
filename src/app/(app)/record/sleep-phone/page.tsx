import { requireUserScope } from "@/shared/auth/require-user-scope";
import { SleepPhoneFlow } from "@/modules/records/ui/sleep-phone-form";

type SearchValue = string | string[] | undefined;

const toStringValue = (value: SearchValue): string => {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
};

export default async function SleepPhonePage({
  searchParams,
}: Readonly<{
  searchParams?: Readonly<{ [key: string]: SearchValue }>;
}>) {
  const params = searchParams ?? {};
  const { timezone } = await requireUserScope();

  const step = toStringValue(params.step);
  const initialValues = {
    sleepStartedAt: toStringValue(params.sleepStartedAt),
    sleepEndedAt: toStringValue(params.sleepEndedAt),
    morningFatigue: toStringValue(params.morningFatigue),
    sleepRecordId: toStringValue(params.sleepRecordId),
    lastUseAt: toStringValue(params.lastUseAt),
    durationMinutes: toStringValue(params.durationMinutes),
    phoneRecordId: toStringValue(params.phoneRecordId),
  };

  return (
    <SleepPhoneFlow
      timezone={timezone}
      step={step}
      initialValues={initialValues}
    />
  );
}
