import Image from "next/image";
import { OnboardingProgress } from "@/modules/onboarding/ui/onboarding-progress";
import { createOnboardingRepository } from "@/modules/onboarding/infrastructure/prisma-onboarding-repository";
import { requireSessionUserId } from "@/shared/auth/require-session-user";
import styles from "@/modules/onboarding/ui/onboarding.module.css";
import { submitProfileAction } from "./actions";

export const onboardingTimezoneOptions = Intl.supportedValuesOf("timeZone");

export default async function ProfilePage() {
  const userId = await requireSessionUserId();
  const repository = createOnboardingRepository(userId);
  const progress = await repository.getProgress();

  const profile = progress.profile;
  const defaultTimezone = profile?.timezone ?? "Asia/Seoul";

  return (
    <main className={styles.onboardingLayout}>
      <section className={styles.onboardingCard}>
        <OnboardingProgress currentStep={4} previousHref="/onboarding/habits" />
        <div className={styles.onboardingBody}>
          <h1>나를 먼저 알려주세요</h1>
          <p className={styles.lead}>수면 분석과 루틴의 기준이 되는 정보예요.</p>
          <form action={submitProfileAction} className={styles.onboardingForm}>
            <label className={styles.field}>
              닉네임
              <input
                name="nickname"
                type="text"
                required
                defaultValue={profile?.nickname ?? ""}
                maxLength={40}
                placeholder="예: 써니"
              />
            </label>

            <label className={styles.field}>
              생활 시간대
              <select name="timezone" required defaultValue={defaultTimezone}>
                {onboardingTimezoneOptions.map((timezone) => (
                  <option key={timezone} value={timezone}>{timezone}</option>
                ))}
              </select>
            </label>

            <aside className={styles.tipCard}>
              <div>
                <strong>생활 시간대를 확인해주세요</strong>
                <p>한국에서는 Asia/Seoul을 선택하고, 나중에도 수정할 수 있어요.</p>
              </div>
              <Image src="/assets/lunar-rabbit/care-rabbit.png" alt="" width={48} height={48} />
            </aside>

            <button type="submit" className={styles.cta}>완료</button>
          </form>
        </div>
      </section>
    </main>
  );
}
