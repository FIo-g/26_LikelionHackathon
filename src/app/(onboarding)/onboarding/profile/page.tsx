import Link from "next/link";
import { OnboardingProgress } from "@/modules/onboarding/ui/onboarding-progress";
import { createOnboardingRepository } from "@/modules/onboarding/infrastructure/prisma-onboarding-repository";
import { requireSessionUserId } from "@/shared/auth/require-session-user";
import styles from "@/modules/onboarding/ui/onboarding.module.css";
import { submitProfileAction } from "./actions";

const timezoneOptions = Array.from(new Set(Intl.supportedValuesOf("timeZone")));

export default async function ProfilePage() {
  const userId = await requireSessionUserId();
  const repository = createOnboardingRepository(userId);
  const progress = await repository.getProgress();

  const profile = progress.profile;
  const defaultTimezone = profile?.timezone ?? "Asia/Seoul";

  return (
    <main className={styles.onboardingLayout}>
      <section className={styles.onboardingCard}>
        <h1>기본 프로필</h1>
        <OnboardingProgress currentStep={4} />
        <form action={submitProfileAction} className={styles.onboardingForm}>
          <label className={styles.field}>
            닉네임
            <input
              name="nickname"
              type="text"
              required
              defaultValue={profile?.nickname ?? ""}
              maxLength={40}
            />
          </label>

          <label className={styles.field}>
            타임존
            <select name="timezone" required defaultValue={defaultTimezone}>
              {timezoneOptions.map((timezone) => (
                <option key={timezone} value={timezone}>{timezone}</option>
              ))}
            </select>
          </label>

          <button type="submit" className={styles.cta}>완료</button>
        </form>

        <p className={styles.nav}>
          <Link href="/onboarding/habits">이전</Link>
        </p>
      </section>
    </main>
  );
}

