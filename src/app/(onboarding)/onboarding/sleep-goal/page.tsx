import Image from "next/image";
import { OnboardingProgress } from "@/modules/onboarding/ui/onboarding-progress";
import { createOnboardingRepository } from "@/modules/onboarding/infrastructure/prisma-onboarding-repository";
import { requireSessionUserId } from "@/shared/auth/require-session-user";
import styles from "@/modules/onboarding/ui/onboarding.module.css";
import { submitSleepGoalAction } from "./actions";

export default async function SleepGoalPage() {
  const userId = await requireSessionUserId();
  const repository = createOnboardingRepository(userId);
  const progress = await repository.getProgress();

  const bedTime = progress.sleepGoal?.targetBedTime ?? "23:00";
  const wakeTime = progress.sleepGoal?.targetWakeTime ?? "07:00";

  return (
    <main className={styles.onboardingLayout}>
      <section className={styles.onboardingCard}>
        <OnboardingProgress currentStep={2} previousHref="/onboarding/connect" />
        <div className={styles.onboardingBody}>
          <h1>어떤 밤을 만들고 싶나요?</h1>
          <p className={styles.lead}>목표 취침·기상 시간을 기준으로 오늘의 준비 시간을 계산해요.</p>
          <form action={submitSleepGoalAction} className={styles.onboardingForm}>
            <div className={styles.goalCard}>
              <strong>목표 수면 리듬</strong>
              <div className={styles.timeRow}>
                <label>
                  <input type="time" name="targetBedTime" defaultValue={bedTime} required aria-label="취침 시간" lang="en-GB" />
                  <span>잠들기</span>
                </label>
                <span aria-hidden="true">→</span>
                <label>
                  <input type="time" name="targetWakeTime" defaultValue={wakeTime} required aria-label="기상 시간" lang="en-GB" />
                  <span>일어나기</span>
                </label>
              </div>
              <p>시간을 눌러 수정할 수 있어요.</p>
            </div>

            <p className={styles.scheduleHint}>주요 일정이 생기면 이후 계획 화면에서 추가할 수 있어요.</p>

            <aside className={styles.rabbitNote}>
              <p>처음 설정한 시간은 언제든 바꿀 수 있어요.<br />기록과 일정이 쌓이면 무리 없는 조정안을 제안합니다.</p>
              <span><Image src="/assets/lunar-rabbit/rabbit-face.png" alt="" width={78} height={78} /></span>
            </aside>

            <button type="submit" className={styles.cta}>다음</button>
          </form>
        </div>
      </section>
    </main>
  );
}
