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
        <OnboardingProgress currentStep={1} />
        <div className={styles.onboardingBody}>
          <h1>나를 먼저 알려주세요</h1>
          <p className={styles.lead}>수면 분석과 루틴의 기준이 되는 정보예요.</p>
          <form action={submitProfileAction} className={`${styles.onboardingForm} ${styles.profileForm}`}>
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
              나이
              <input
                defaultValue={profile?.age ?? ""}
                inputMode="numeric"
                max={120}
                min={1}
                name="age"
                placeholder="입력해주세요"
                step={1}
                type="number"
              />
            </label>

            <fieldset className={styles.choiceFieldset}>
              <legend>성별</legend>
              <div className={styles.choiceRow}>
                <ProfileChoice label="여성" selected={profile?.gender === "female"} value="female" />
                <ProfileChoice label="남성" selected={profile?.gender === "male"} value="male" />
                <ProfileChoice label="응답 안 함" selected={profile?.gender === "prefer-not-to-say"} value="prefer-not-to-say" />
              </div>
            </fieldset>

            <div className={styles.measureRow}>
              <label className={styles.field}>
                키
                <input
                  defaultValue={profile?.heightCm ?? ""}
                  inputMode="numeric"
                  max={300}
                  min={50}
                  name="heightCm"
                  placeholder="예: 165 cm"
                  step={1}
                  type="number"
                />
              </label>
              <label className={styles.field}>
                몸무게
                <input
                  defaultValue={profile?.weightKg ?? ""}
                  inputMode="decimal"
                  max={500}
                  min={20}
                  name="weightKg"
                  placeholder="예: 58 kg"
                  step={0.1}
                  type="number"
                />
              </label>
            </div>

            <aside className={styles.tipCard}>
              <div>
                <strong>정확한 숫자가 아니어도 괜찮아요</strong>
                <p>나중에 개인정보 · 목표에서 언제든 수정할 수 있어요.</p>
                <label className={styles.timezoneField}>
                  생활 시간대
                  <select name="timezone" required defaultValue={defaultTimezone}>
                    {onboardingTimezoneOptions.map((timezone) => (
                      <option key={timezone} value={timezone}>{timezone}</option>
                    ))}
                  </select>
                </label>
              </div>
              <Image src="/assets/lunar-rabbit/care-rabbit.png" alt="" width={48} height={48} />
            </aside>

            <button type="submit" className={styles.cta}>다음</button>
          </form>
        </div>
      </section>
    </main>
  );
}

const ProfileChoice = ({ label, selected, value }: Readonly<{
  label: string;
  selected: boolean;
  value: "female" | "male" | "prefer-not-to-say";
}>) => (
  <label className={styles.choiceChip}>
    <input defaultChecked={selected} name="gender" type="radio" value={value} />
    <span>{label}</span>
  </label>
);
