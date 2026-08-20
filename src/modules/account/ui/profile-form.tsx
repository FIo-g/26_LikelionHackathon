"use client";

import { useActionState } from "react";
import { updateProfileAction } from "@/app/(app)/account/actions";
import { accountActionIdle } from "../domain/schemas";
import styles from "./account.module.css";

const baseTimezones = ["Asia/Seoul", "America/New_York", "Europe/London", "UTC"];

export const ProfileForm = ({ identity, profile }: Readonly<{ identity: { email: string | null }; profile: { nickname: string; timezone: string } }>) => {
  const [state, formAction, pending] = useActionState(updateProfileAction, accountActionIdle);
  const timezones = Array.from(new Set([profile.timezone, ...baseTimezones]));
  return <form action={formAction} className={styles.form}>
    <label>로그인 이메일<input aria-label="로그인 이메일" readOnly value={identity.email ?? "인증된 이메일 정보를 불러올 수 없어요."} /></label>
    <p className={styles.privacyNote}>이메일 변경은 인증 제공자에서만 관리합니다.</p>
    <label>닉네임<input defaultValue={state.values.nickname ?? profile.nickname} maxLength={40} name="nickname" required /></label>
    {state.fieldErrors.nickname?.map((message) => <p className={styles.error} key={message} role="alert">{message}</p>)}
    <label>타임존<select defaultValue={state.values.timezone ?? profile.timezone} name="timezone" required>{timezones.map((timezone) => <option key={timezone} value={timezone}>{timezone}</option>)}</select></label>
    <p className={styles.privacyNote}>타임존 변경은 이후 기록과 계획에만 적용되며, 기존 기록과 과거 계획은 바꾸지 않습니다.</p>
    {state.fieldErrors._form?.map((message) => <p className={styles.error} key={message} role="alert">{message}</p>)}
    <button disabled={pending} type="submit">{pending ? "저장 중" : "개인 정보 저장"}</button>
  </form>;
};
