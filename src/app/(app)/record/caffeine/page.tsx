import { requireUserScope } from "@/shared/auth/require-user-scope";
import { CaffeineFlow } from "@/modules/records/ui/caffeine-flow";

type SearchValue = string | string[] | undefined;

const toStringValue = (value: SearchValue): string => {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
};

export default async function CaffeinePage({
  searchParams,
}: Readonly<{
  searchParams?: Readonly<{ [key: string]: SearchValue }>;
}>) {
  const params = searchParams ?? {};
  const { timezone } = await requireUserScope();
  const step = toStringValue(params.step);
  const initialValues = {
    brand: toStringValue(params.brand),
    product: toStringValue(params.product),
    caffeineMg: toStringValue(params.caffeineMg),
    consumedAt: toStringValue(params.consumedAt),
  };

  return (
    <CaffeineFlow
      timezone={timezone}
      step={step}
      initialValues={initialValues}
    />
  );
}
