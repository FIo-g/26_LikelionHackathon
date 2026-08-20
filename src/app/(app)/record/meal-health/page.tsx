import { requireUserScope } from "@/shared/auth/require-user-scope";
import { MealHealthFlow } from "@/modules/records/ui/meal-health-form";

type MealHealthPageProps = Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>;

const firstParam = (value: string | string[] | undefined): string | undefined => Array.isArray(value) ? value[0] : value;

export default async function MealHealthPage({ searchParams }: MealHealthPageProps) {
  const { timezone } = await requireUserScope();
  const query = await searchParams;
  return <MealHealthFlow focus={firstParam(query.focus)} timezone={timezone} step={firstParam(query.step)} />;
}
