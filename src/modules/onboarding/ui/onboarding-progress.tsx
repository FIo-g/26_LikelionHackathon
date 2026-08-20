import type { OnboardingStep } from "../domain/types";

const STEPS = [1, 2, 3, 4] as const;

type OnboardingProgressProps = Readonly<{
  currentStep: OnboardingStep;
}>;

export const OnboardingProgress = ({ currentStep }: OnboardingProgressProps) => {
  return (
    <ol className="onboarding-progress-list" aria-label="온보딩 단계 진행도">
      {STEPS.map((step) => {
        const isCurrent = step === currentStep;
        const isPast = step < currentStep;
        const label = isCurrent ? "현재 단계" : isPast ? "완료" : "예정";
        const text = `${step}단계, ${label}`;

        return (
          <li key={step} aria-label={text}>
            <span>{step} 단계</span>
            <span>{label}</span>
          </li>
        );
      })}
    </ol>
  );
};

