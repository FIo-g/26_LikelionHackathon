"use client";

import { useActionState } from "react";
import { updateProfileAction } from "@/app/(app)/account/actions";
import type { AccountViewModel } from "../application/ports";
import { accountActionIdle } from "../domain/schemas";
import styles from "./account.module.css";

const baseTimezones = ["Asia/Seoul", "America/New_York", "Europe/London", "UTC"];

type ProfileFormProps = Readonly<{
  identity: { email: string | null };
  profile: AccountViewModel["profile"];
  idPrefix?: string;
}>;

const fieldError = (fieldErrors: Record<string, readonly string[]>, field: string): string | null => (
  fieldErrors[field]?.join(" ") ?? null
);

const formValue = (values: Record<string, string>, key: string, fallback: string): string => values[key] ?? fallback;

export const ProfileForm = ({ identity, profile, idPrefix = "profile" }: ProfileFormProps) => {
  const [state, formAction, pending] = useActionState(updateProfileAction, accountActionIdle);
  const timezones = Array.from(new Set([profile.timezone, ...baseTimezones]));
  const nicknameError = fieldError(state.fieldErrors, "nickname");
  const ageError = fieldError(state.fieldErrors, "age");
  const genderError = fieldError(state.fieldErrors, "gender");
  const heightError = fieldError(state.fieldErrors, "heightCm");
  const weightError = fieldError(state.fieldErrors, "weightKg");
  const allErrors = [nicknameError, ageError, genderError, heightError, weightError].filter((value): value is string => Boolean(value));
  const formMessage = state.status === "success" ? "개인 정보가 저장되었습니다." : [...(state.fieldErrors._form ?? []), ...allErrors].join(" ");
  const nicknameErrorId = `${idPrefix}-nickname-error`;
  const ageErrorId = `${idPrefix}-age-error`;
  const genderErrorId = `${idPrefix}-gender-error`;
  const heightErrorId = `${idPrefix}-height-error`;
  const weightErrorId = `${idPrefix}-weight-error`;
  return <form action={formAction} aria-busy={pending} className={`${styles.form} ${styles.profileForm}`}>
    <div className={styles.profileField}><label htmlFor={`${idPrefix}-email`}>로그인 이메일</label><input aria-label="로그인 이메일" id={`${idPrefix}-email`} readOnly value={identity.email ?? "인증된 이메일 정보를 불러올 수 없어요."} /></div>
    <div className={styles.profileField}><label htmlFor={`${idPrefix}-nickname`}>닉네임</label><input aria-describedby={nicknameError ? nicknameErrorId : undefined} aria-invalid={nicknameError ? true : undefined} defaultValue={formValue(state.values, "nickname", profile.nickname)} id={`${idPrefix}-nickname`} maxLength={40} name="nickname" required />{nicknameError ? <p className={styles.error} id={nicknameErrorId}>{nicknameError}</p> : null}</div>
    <div className={styles.profileField}><label htmlFor={`${idPrefix}-age`}>나이</label><input aria-describedby={ageError ? ageErrorId : undefined} aria-invalid={ageError ? true : undefined} defaultValue={formValue(state.values, "age", profile.age?.toString() ?? "")} id={`${idPrefix}-age`} inputMode="numeric" max={120} min={1} name="age" type="number" />{ageError ? <p className={styles.error} id={ageErrorId}>{ageError}</p> : null}</div>
    <div className={styles.profileField}><label htmlFor={`${idPrefix}-gender`}>성별</label><select aria-describedby={genderError ? genderErrorId : undefined} aria-invalid={genderError ? true : undefined} defaultValue={formValue(state.values, "gender", profile.gender ?? "")} id={`${idPrefix}-gender`} name="gender"><option value="">선택하지 않음</option><option value="female">여성</option><option value="male">남성</option><option value="nonbinary">논바이너리</option><option value="prefer-not-to-say">응답하지 않음</option></select>{genderError ? <p className={styles.error} id={genderErrorId}>{genderError}</p> : null}</div>
    <div className={styles.profileField}><label htmlFor={`${idPrefix}-height`}>키 (cm)</label><input aria-describedby={heightError ? heightErrorId : undefined} aria-invalid={heightError ? true : undefined} defaultValue={formValue(state.values, "heightCm", profile.heightCm?.toString() ?? "")} id={`${idPrefix}-height`} inputMode="numeric" max={300} min={50} name="heightCm" type="number" />{heightError ? <p className={styles.error} id={heightErrorId}>{heightError}</p> : null}</div>
    <div className={styles.profileField}><label htmlFor={`${idPrefix}-weight`}>몸무게 (kg)</label><input aria-describedby={weightError ? weightErrorId : undefined} aria-invalid={weightError ? true : undefined} defaultValue={formValue(state.values, "weightKg", profile.weightKg?.toString() ?? "")} id={`${idPrefix}-weight`} inputMode="decimal" max={500} min={20} name="weightKg" step="0.1" type="number" />{weightError ? <p className={styles.error} id={weightErrorId}>{weightError}</p> : null}</div>
    <div className={styles.profileField}><label htmlFor={`${idPrefix}-timezone`}>타임존</label><select defaultValue={formValue(state.values, "timezone", profile.timezone)} id={`${idPrefix}-timezone`} name="timezone" required>{timezones.map((timezone) => <option key={timezone} value={timezone}>{timezone}</option>)}</select></div>
    <p className={`${styles.privacyNote} ${styles.profilePrivacy}`}>이메일은 인증 제공자에서 관리합니다. 신체 정보는 개인화 기준에만 사용하며, 원하면 비워둘 수 있습니다. 타임존 변경은 이후 기록과 계획에만 적용됩니다.</p>
    <p aria-live="polite" className={formMessage ? styles.error : styles.liveRegion} role="status">{formMessage}</p>
    <button disabled={pending} type="submit">{pending ? "저장 중" : "개인 정보 저장"}</button>
  </form>;
};
