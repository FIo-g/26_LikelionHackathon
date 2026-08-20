import Image from "next/image";
import { OnboardingProgress } from "@/modules/onboarding/ui/onboarding-progress";
import { createOnboardingRepository } from "@/modules/onboarding/infrastructure/prisma-onboarding-repository";
import { requireSessionUserId } from "@/shared/auth/require-session-user";
import styles from "@/modules/onboarding/ui/onboarding.module.css";
import { submitHabitsAction } from "./actions";

const HABIT_OPTIONS = {
  caffeine: [
    { label: "거의 안 마심", value: "none" },
    { label: "가끔", value: "sometimes" },
    { label: "매일", value: "daily" },
  ],
  exercise: [
    { label: "0~1회", value: "rare" },
    { label: "주 1~2회", value: "weekly" },
    { label: "주 3회 이상", value: "frequent" },
  ],
  meal: [
    { label: "이른 편", value: "early" },
    { label: "보통", value: "mixed" },
    { label: "늦은 편", value: "late" },
  ],
  phoneUsage: [
    { label: "낮음", value: "low" },
    { label: "보통", value: "medium" },
    { label: "높음", value: "high" },
  ],
} as const;

export default async function HabitsPage() {
  const userId = await requireSessionUserId();
  const repository = createOnboardingRepository(userId);
  const progress = await repository.getProgress();

  const habits = progress.habits;

  return (
    <main className={styles.onboardingLayout}>
      <section className={styles.onboardingCard}>
        <OnboardingProgress currentStep={3} previousHref="/onboarding/sleep-goal" />
        <div className={styles.onboardingBody}>
          <h1>평소 습관을 골라주세요</h1>
          <p className={styles.lead}>객관식으로 간단히 선택해요.</p>
          <form action={submitHabitsAction} className={styles.onboardingForm}>
            <HabitChoice name="caffeine" legend="하루 평균 카페인 섭취" options={HABIT_OPTIONS.caffeine} selected={habits?.caffeine ?? "none"} />
            <HabitChoice name="meal" legend="평소 식사 시간" options={HABIT_OPTIONS.meal} selected={habits?.meal ?? "mixed"} />
            <HabitChoice name="exercise" legend="일주일 평균 운동 횟수" options={HABIT_OPTIONS.exercise} selected={habits?.exercise ?? "rare"} />
            <HabitChoice name="phoneUsage" legend="잠들기 전 휴대폰 사용" options={HABIT_OPTIONS.phoneUsage} selected={habits?.phoneUsage ?? "low"} />

            <aside className={styles.rabbitNote}>
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
  name: keyof typeof HABIT_OPTIONS;
  legend: string;
  options: ReadonlyArray<Readonly<{ label: string; value: string }>>;
  selected: string;
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
