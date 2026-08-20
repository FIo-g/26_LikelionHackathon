import { requireUserScope } from "@/shared/auth/require-user-scope";
import { AlcoholFlow } from "@/modules/records/ui/alcohol-flow";

type AlcoholPageProps = Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>;

const firstParam = (value: string | string[] | undefined): string | undefined => Array.isArray(value) ? value[0] : value;

export default async function AlcoholPage({ searchParams }: AlcoholPageProps) {
  const { timezone } = await requireUserScope();
  const query = await searchParams;
  return <AlcoholFlow freshCreate={firstParam(query.mode) === "create"} timezone={timezone} step={firstParam(query.step)} />;
}
