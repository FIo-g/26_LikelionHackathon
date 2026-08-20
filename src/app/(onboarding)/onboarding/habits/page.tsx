import Image from "next/image";
import { OnboardingProgress } from "@/modules/onboarding/ui/onboarding-progress";
import { createOnboardingRepository } from "@/modules/onboarding/infrastructure/prisma-onboarding-repository";
import { requireSessionUserId } from "@/shared/auth/require-session-user";
import styles from "@/modules/onboarding/ui/onboarding.module.css";
import { submitHabitsAction } from "./actions";
import { redirectIfOnboardingPrerequisiteIsMissing } from "../flow";

const HABIT_OPTIONS = {
  caffeine: [
    { label: "거의 안 마심", value: "none" },
    { label: "1잔 내외", value: "sometimes" },
    { label: "2잔 이상", value: "daily" },
  ],
  meal: [
    { label: "1회 이하", value: "early" },
    { label: "2회", value: "mixed" },
    { label: "3회 이상", value: "late" },
  ],
  exercise: [
    { label: "0~1회", value: "rare" },
    { label: "2~3회", value: "weekly" },
    { label: "4회 이상", value: "frequent" },
  ],
} as const;

export default async function HabitsPage() {
  const userId = await requireSessionUserId();
  const repository = createOnboardingRepository(userId);
  const progress = await repository.getProgress();
  redirectIfOnboardingPrerequisiteIsMissing(progress, "habits");

  const habits = progress.habits;
  // The Figma layer has one middle frequency choice. Keep a pre-existing
  // monthly value on resume instead of silently coercing it to weekly.
  const alcoholOptions = [
    { label: "0회", value: "none" },
    { label: "1~2회", value: habits?.alcohol === "monthly" ? "monthly" : "weekly" },
    { label: "3회 이상", value: "frequent" },
  ] as const;

  return (
    <main className={styles.onboardingLayout}>
      <section className={styles.onboardingCard}>
        <OnboardingProgress currentStep={2} previousHref="/onboarding/profile" />
        <div className={styles.onboardingBody}>
          <h1>평소 습관을 골라주세요</h1>
          <p className={styles.lead}>여기부터는 객관식으로 간단히 선택해요.</p>
          <form action={submitHabitsAction} className={styles.onboardingForm}>
            <HabitChoice name="caffeine" legend="하루 평균 카페인 섭취량" options={HABIT_OPTIONS.caffeine} selected={habits?.caffeine} />
            <HabitChoice name="meal" legend="하루 평균 식사 횟수" options={HABIT_OPTIONS.meal} selected={habits?.meal} />
            <HabitChoice name="alcohol" legend="일주일 평균 음주 횟수" options={alcoholOptions} selected={habits?.alcohol ?? undefined} />
            <HabitChoice name="exercise" legend="일주일 평균 운동 횟수" options={HABIT_OPTIONS.exercise} selected={habits?.exercise} />
            <input name="phoneUsage" type="hidden" value={habits?.phoneUsage ?? "low"} />

            <aside className={`${styles.rabbitNote} ${styles.habitReassurance}`}>
              <p>대략적인 평균으로 시작해도 괜찮아요.<br />기록이 쌓이면 실제 패턴으로 보정됩니다.</p>
              <span><Image src="/assets/lunar-rabbit/care-rabbit.png" alt="" width={78} height={78} /></span>
            </aside>

            <button type="submit" className={styles.cta}>다음</button>
          </form>
        </div>
      </section>
    </main>
  );
}

type HabitChoiceProps = Readonly<{
  name: "caffeine" | "meal" | "alcohol" | "exercise";
  legend: string;
  options: ReadonlyArray<Readonly<{ label: string; value: string }>>;
  selected?: string | null;
}>;

const HabitChoice = ({ name, legend, options, selected }: HabitChoiceProps) => (
  <fieldset className={styles.choiceFieldset}>
    <legend>{legend}</legend>
    <div className={styles.choiceRow}>
      {options.map((item) => (
        <label className={styles.choiceChip} key={item.value}>
          <input type="radio" name={name} value={item.value} defaultChecked={item.value === selected} required />
          <span>{item.label}</span>
        </label>
      ))}
    </div>
  </fieldset>
);
