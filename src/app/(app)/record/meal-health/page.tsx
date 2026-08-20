import { requireUserScope } from "@/shared/auth/require-user-scope";
import { MealHealthFlow } from "@/modules/records/ui/meal-health-form";

export default async function MealHealthPage() {
  const { timezone } = await requireUserScope();
  return <MealHealthFlow timezone={timezone} />;
}
