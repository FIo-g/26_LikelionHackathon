import { requireUserScope } from "@/shared/auth/require-user-scope";
import { AlcoholFlow } from "@/modules/records/ui/alcohol-flow";

type SearchValue = string | string[] | undefined;

const toStringValue = (value: SearchValue): string => {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
};

export default async function AlcoholPage({
  searchParams,
}: Readonly<{
  searchParams?: Readonly<{ [key: string]: SearchValue }>;
}>) {
  const params = searchParams ?? {};
  const { timezone } = await requireUserScope();

  const step = toStringValue(params.step);
  const initialValues = {
    alcoholType: toStringValue(params.alcoholType),
    servings: toStringValue(params.servings),
    consumedAt: toStringValue(params.consumedAt),
  };

  return (
    <AlcoholFlow
      timezone={timezone}
      step={step}
      initialValues={initialValues}
    />
  );
}
