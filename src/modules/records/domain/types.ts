export type RecordType =
  | "sleep"
  | "caffeine"
  | "alcohol"
  | "meal"
  | "exercise"
  | "phone-usage"
  | "wellness";

type MealSize = "small" | "medium" | "large";
type Intensity = "low" | "medium" | "high";

export type CreateRecordInput = (
  | {
    type: "sleep";
    startedAt: Date;
    endedAt: Date;
    morningFatigue: number;
    timezone: string;
  }
  | {
    type: "caffeine";
    brand: string;
    product: string;
    caffeineMg: number;
    consumedAt: Date;
    timezone: string;
  }
  | {
    type: "alcohol";
    alcoholType: string;
    servings: number;
    consumedAt: Date;
    timezone: string;
  }
  | {
    type: "meal";
    size: MealSize;
    eatenAt: Date;
    notes: string | null;
    timezone: string;
  }
  | {
    type: "exercise";
    exerciseType: string;
    intensity: Intensity;
    startedAt: Date;
    endedAt: Date;
    averageHeartRate: number | null;
    timezone: string;
  }
  | {
    type: "phone-usage";
    lastUseAt: Date;
    durationMinutes: number;
    timezone: string;
  }
  | {
    type: "wellness";
    localDate: string;
    fatigueLevel: number;
    stressLevel: number;
    timezone: string;
  }
);

export type UpdateRecordInput = CreateRecordInput;

export type RecordEntity = Readonly<CreateRecordInput & {
  id: string;
  userId: string;
  localDate: string;
}>;

export type SerializedRecord = Readonly<{
  id: string;
  userId: string;
  type: RecordType;
  localDate: string;
  fields: Readonly<Record<string, string | number | null>>;
}>;
