import { requireUserScope } from "@/shared/auth/require-user-scope";
import { MealHealthFlow } from "@/modules/records/ui/meal-health-form";

type SearchValue = string | string[] | undefined;
type RecordPageProps = { searchParams?: Promise<Record<string, SearchValue>> };

const toStringValue = (value: SearchValue): string => {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
};

export default async function MealHealthPage({
  searchParams,
}: RecordPageProps) {
  const params = (await searchParams) ?? {};
  const { timezone } = await requireUserScope();

  const step = toStringValue(params.step);
  const initialValues = {
    mealSize: toStringValue(params.mealSize),
    mealEatenAt: toStringValue(params.mealEatenAt),
    mealNotes: toStringValue(params.mealNotes),
    mealRecordId: toStringValue(params.mealRecordId),
    exerciseType: toStringValue(params.exerciseType),
    exerciseIntensity: toStringValue(params.exerciseIntensity),
    exerciseStartedAt: toStringValue(params.exerciseStartedAt),
    exerciseEndedAt: toStringValue(params.exerciseEndedAt),
    exerciseAverageHeartRate: toStringValue(params.exerciseAverageHeartRate),
    exerciseRecordId: toStringValue(params.exerciseRecordId),
    fatigueLevel: toStringValue(params.fatigueLevel),
    stressLevel: toStringValue(params.stressLevel),
    wellnessRecordId: toStringValue(params.wellnessRecordId),
    wellnessLocalDate: toStringValue(params.wellnessLocalDate),
  };

  return (
    <MealHealthFlow
      timezone={timezone}
      step={step}
      initialValues={initialValues}
    />
  );
}
