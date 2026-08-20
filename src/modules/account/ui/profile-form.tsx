"use client";

import { useActionState } from "react";
import { updateProfileAction } from "@/app/(app)/account/actions";
import { accountActionIdle } from "../domain/schemas";
import styles from "./account.module.css";

const baseTimezones = ["Asia/Seoul", "America/New_York", "Europe/London", "UTC"];

export const ProfileForm = ({ identity, profile, idPrefix = "profile" }: Readonly<{ identity: { email: string | null }; profile: { nickname: string; timezone: string }; idPrefix?: string }>) => {
  const [state, formAction, pending] = useActionState(updateProfileAction, accountActionIdle);
  const timezones = Array.from(new Set([profile.timezone, ...baseTimezones]));
  const nicknameError = state.fieldErrors.nickname?.join(" ") ?? null;
  const formMessage = state.status === "success" ? "개인 정보가 저장되었습니다." : [...(state.fieldErrors._form ?? []), ...(nicknameError ? [nicknameError] : [])].join(" ");
  const nicknameErrorId = `${idPrefix}-nickname-error`;
  return <form action={formAction} aria-busy={pending} className={`${styles.form} ${styles.profileForm}`}>
    <div className={styles.profileField}><label htmlFor={`${idPrefix}-email`}>로그인 이메일</label><input aria-label="로그인 이메일" id={`${idPrefix}-email`} readOnly value={identity.email ?? "인증된 이메일 정보를 불러올 수 없어요."} /></div>
    <div className={styles.profileField}><label htmlFor={`${idPrefix}-nickname`}>닉네임</label><input aria-describedby={nicknameError ? nicknameErrorId : undefined} aria-invalid={nicknameError ? true : undefined} defaultValue={state.values.nickname ?? profile.nickname} id={`${idPrefix}-nickname`} maxLength={40} name="nickname" required />{nicknameError ? <p className={styles.error} id={nicknameErrorId}>{nicknameError}</p> : null}</div>
    <div className={styles.profileField}><label htmlFor={`${idPrefix}-timezone`}>타임존</label><select defaultValue={state.values.timezone ?? profile.timezone} id={`${idPrefix}-timezone`} name="timezone" required>{timezones.map((timezone) => <option key={timezone} value={timezone}>{timezone}</option>)}</select></div>
    <p className={`${styles.privacyNote} ${styles.profilePrivacy}`}>이메일은 인증 제공자에서 관리합니다. 타임존 변경은 이후 기록과 계획에만 적용되며 기존 기록은 바꾸지 않습니다.</p>
    <p aria-live="polite" className={formMessage ? styles.error : styles.liveRegion} role="status">{formMessage}</p>
    <button disabled={pending} type="submit">{pending ? "저장 중" : "개인 정보 저장"}</button>
  </form>;
};
