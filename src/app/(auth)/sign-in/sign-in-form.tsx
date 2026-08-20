"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { authClient } from "@/shared/auth/auth-client";
import { toKoreanAuthError, type KoreanAuthErrorCode } from "@/shared/auth/sign-in-error";
import styles from "../auth.module.css";

type SignInFormProps = {
  returnTo: string;
};

export const SignInForm = ({ returnTo }: SignInFormProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    const result = await authClient.signIn.email({
      email,
      password,
      callbackURL: returnTo,
    });

    if (result.error) {
      const code = (result.error as { code?: KoreanAuthErrorCode }).code;
      setFormError(toKoreanAuthError(code));
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    window.location.href = returnTo;
  };

  return (
    <form onSubmit={submit} className={styles.form}>
      <label className={styles.label}>
        이메일
        <input
          className={styles.field}
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          value={email}
          onChange={(event) => setEmail(event.currentTarget.value)}
          required
        />
      </label>
      <label className={styles.label}>
        비밀번호
        <input
          className={styles.field}
          type="password"
          autoComplete="current-password"
          placeholder="비밀번호를 입력해주세요"
          value={password}
          onChange={(event) => setPassword(event.currentTarget.value)}
          required
        />
      </label>
      {formError ? <p className={styles.error}>{formError}</p> : null}
      <button
        type="submit"
        className={styles.button}
        disabled={isSubmitting}
        aria-busy={isSubmitting ? "true" : "false"}
      >
        로그인
      </button>
    </form>
  );
};
