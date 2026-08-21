import { requireUserScope } from "@/shared/auth/require-user-scope";
import { CaffeineFlow } from "@/modules/records/ui/caffeine-flow";

type SearchParams = Record<string, string | string[] | undefined>;

type CaffeinePageProps = Readonly<{
  searchParams: Promise<SearchParams>;
}>;

const firstParam = (value: string | string[] | undefined): string | undefined => (
  Array.isArray(value) ? value[0] : value
);

export default async function CaffeinePage({ searchParams }: CaffeinePageProps) {
  const { timezone } = await requireUserScope();
  const query = await searchParams;

  return (
    <CaffeineFlow
      freshCreate={firstParam(query.mode) === "create"}
      timezone={timezone}
      step={firstParam(query.step)}
    />
  );
}
