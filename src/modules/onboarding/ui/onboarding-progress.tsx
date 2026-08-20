import Image from "next/image";
import Link from "next/link";
import type { OnboardingStep } from "../domain/types";
import styles from "./onboarding.module.css";

const STEPS = [1, 2, 3, 4] as const;
const STEP_LABELS: Readonly<Record<OnboardingStep, string>> = {
  1: "연결 설정",
  2: "수면 목표",
  3: "평균 습관",
  4: "기본 정보",
};

type OnboardingProgressProps = Readonly<{
  currentStep: OnboardingStep;
  previousHref?: string;
}>;

export const OnboardingProgress = ({ currentStep, previousHref }: OnboardingProgressProps) => {
  return (
    <header className={styles.progressHeader}>
      <Image
        className={styles.progressBackdrop}
        src="/assets/lunar-rabbit/night-header.svg"
        alt=""
        width={390}
        height={154}
        priority
      />
      <div className={styles.progressMeta}>
        <strong>{currentStep} / 4</strong>
        <span>{STEP_LABELS[currentStep]}</span>
      </div>
      <ol className={styles.progressList} aria-label="온보딩 단계 진행도">
        {STEPS.map((step) => {
          const isCurrent = step === currentStep;
          const isPast = step < currentStep;
          const label = isCurrent ? "현재 단계" : isPast ? "완료" : "예정";
          const text = `${step}단계, ${label}`;

          return (
            <li
              key={step}
              className={isCurrent || isPast ? styles.progressDone : undefined}
              aria-label={text}
            >
              <span className={styles.srOnly}>{text}</span>
            </li>
          );
        })}
      </ol>
      {previousHref ? (
        <Link className={styles.backLink} href={previousHref} aria-label="이전 단계">
          ‹
        </Link>
      ) : null}
    </header>
  );
};
