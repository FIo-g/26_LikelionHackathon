import { OnboardingProgress } from "@/modules/onboarding/ui/onboarding-progress";
import { DeviceConnectOption } from "@/modules/onboarding/ui/device-connect-option";
import styles from "@/modules/onboarding/ui/onboarding.module.css";
import { submitConnectAction } from "./actions";
import { createOnboardingRepository } from "@/modules/onboarding/infrastructure/prisma-onboarding-repository";
import { requireSessionUserId } from "@/shared/auth/require-session-user";

export default async function ConnectPage() {
  const userId = await requireSessionUserId();
  const repository = createOnboardingRepository(userId);
  const progress = await repository.getProgress();

  return (
    <main className={styles.onboardingLayout}>
      <section className={styles.onboardingCard}>
        <h1>연결 방식 선택</h1>
        <OnboardingProgress currentStep={1} />
        <DeviceConnectOption type="wearable" availability="coming-soon" selected={false} state="unavailable" />
        <DeviceConnectOption type="phone" availability="coming-soon" selected={false} state="unavailable" />
        <p>또는 아래에서 직접 입력으로 시작하세요.</p>
        <p>직접 입력으로 수면 플랜 시작하기</p>

        <form action={submitConnectAction} className={styles.onboardingForm}>
          <input type="hidden" name="selected" value={progress.connect?.selected ?? "manual"} />
          <button type="submit" className={styles.cta}>연결하기</button>
        </form>
      </section>
    </main>
  );
}

