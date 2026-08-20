import { OnboardingProgress } from "@/modules/onboarding/ui/onboarding-progress";
import { DeviceConnectOption } from "@/modules/onboarding/ui/device-connect-option";
import styles from "@/modules/onboarding/ui/onboarding.module.css";
import { submitConnectAction } from "./actions";
import { createOnboardingRepository } from "@/modules/onboarding/infrastructure/prisma-onboarding-repository";
import { requireSessionUserId } from "@/shared/auth/require-session-user";
import Image from "next/image";
import { redirectIfOnboardingPrerequisiteIsMissing } from "../flow";

export default async function ConnectPage() {
  const userId = await requireSessionUserId();
  const repository = createOnboardingRepository(userId);
  const progress = await repository.getProgress();
  redirectIfOnboardingPrerequisiteIsMissing(progress, "connect");

  return (
    <main className={styles.onboardingLayout}>
      <section className={styles.onboardingCard}>
        <OnboardingProgress currentStep={4} previousHref="/onboarding/sleep-goal" />
        <div className={styles.onboardingBody}>
          <h1>가능한 데이터만<br />편하게 연결하세요</h1>
          <p className={styles.lead}>연결하지 않아도 필요한 항목을 직접 기록할 수 있어요.</p>
          <form action={submitConnectAction} className={styles.onboardingForm}>
            <div className={styles.deviceStack}>
              <DeviceConnectOption type="wearable" availability="coming-soon" selected={false} state="unavailable" />
              <DeviceConnectOption type="phone" availability="coming-soon" selected={false} state="unavailable" />
            </div>

            <aside className={styles.manualTip}>
              <strong>이 설정은 나중에도 바꿀 수 있어요</strong>
              <p>수면은 기상 후 어젯밤 기준으로 직접 기록합니다.</p>
            </aside>

            <aside className={`${styles.rabbitNote} ${styles.connectCompletion}`}>
              <p>필수 단계가 끝났어요.<br />연결 여부와 관계없이 바로 시작할 수 있습니다.</p>
              <span><Image src="/assets/lunar-rabbit/care-rabbit.png" alt="" width={82} height={82} /></span>
            </aside>

            <input type="hidden" name="selected" value={progress.connect?.selected ?? "manual"} />
            <button type="submit" className={styles.cta}>수면 플랜 시작하기</button>
          </form>
        </div>
      </section>
    </main>
  );
}
