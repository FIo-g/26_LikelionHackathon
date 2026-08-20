"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { deleteAccountActionIdle, deleteUserAccountAction } from "@/app/(app)/account/actions";
import styles from "./account.module.css";

type DataManagementProps = Readonly<{ reauth: { exportRequiresReauth: boolean; deleteRequiresReauth: boolean } }>;
const FOCUSABLE_SELECTOR = "button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex='-1'])";

export const DataManagement = ({ reauth }: DataManagementProps) => {
  const [password, setPassword] = useState("");
  const [exportState, setExportState] = useState<"idle" | "pending" | "error">("idle");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [confirmationPhrase, setConfirmationPhrase] = useState("");
  const [deleteState, deleteAction, deletePending] = useActionState(deleteUserAccountAction, deleteAccountActionIdle);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!deleteOpen) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : triggerRef.current;
    dialogRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !deletePending) {
        event.preventDefault();
        setDeleteOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      (previous?.isConnected ? previous : triggerRef.current)?.focus();
    };
  }, [deleteOpen, deletePending]);

  const exportData = async () => {
    setExportState("pending");
    try {
      const response = await fetch("/api/account/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: password || null }) });
      if (!response.ok) throw new Error("EXPORT_FAILED");
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `sleep-planner-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setExportState("idle");
    } catch {
      setExportState("error");
    }
  };

  const canDelete = confirmationEmail.trim().length > 0 && confirmationPhrase === "계정 삭제";

  return <section className={styles.dataEntry} data-testid="account-data-management" aria-labelledby="data-management-title">
    <p className={styles.eyebrow}>PRIVACY</p><h2 id="data-management-title">데이터 관리</h2><p>내보내기와 계정 데이터 삭제는 본인 확인 후에만 진행할 수 있습니다.</p>
    <ul><li>{reauth.exportRequiresReauth ? "데이터 내보내기: 재인증 필요" : "데이터 내보내기"}</li><li>{reauth.deleteRequiresReauth ? "계정 데이터 삭제: 재인증 필요" : "계정 데이터 삭제"}</li></ul>
    <div className={styles.dataActions}>
      <label>비밀번호 (최근 로그인 후 5분이 지났다면 필요)<input aria-label="내보내기 비밀번호" autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} type="password" value={password} /></label>
      <button type="button" onClick={exportData} disabled={exportState === "pending"}>{exportState === "pending" ? "내보내는 중..." : "내 데이터 내보내기"}</button>
      {exportState === "error" ? <p className={styles.error} role="alert">내보내기를 완료하지 못했어요. 다시 로그인하거나 비밀번호를 확인해 주세요.</p> : null}
    </div>
    <div className={styles.deleteNotice}><strong>계정과 저장된 수면 데이터를 영구히 삭제</strong><p>삭제 후에는 복구할 수 없으며, 모든 기기에서 바로 로그아웃됩니다.</p><button ref={triggerRef} className={styles.dangerButton} type="button" onClick={() => setDeleteOpen(true)}>계정 삭제</button></div>
    <p className={styles.privacyNote}>내보내기 파일에는 로그인 비밀번호, 세션, 인증 토큰, 연결 비밀정보와 AI 프롬프트를 포함하지 않습니다.</p>
    {deleteOpen ? <div className={styles.dataDialogBackdrop} role="presentation"><section ref={dialogRef} className={styles.dataDialog} role="dialog" aria-modal="true" aria-labelledby="delete-account-title" tabIndex={-1}>
      <p className={styles.eyebrow}>PERMANENT ACTION</p><h2 id="delete-account-title">계정 삭제 확인</h2><p>계정과 저장된 기록, 계획, 분석 및 케어 데이터가 한 번에 삭제됩니다.</p>
      <form action={deleteAction} className={styles.form}>
        <label>확인 이메일<input aria-label="확인 이메일" autoComplete="email" name="confirmationEmail" onChange={(event) => setConfirmationEmail(event.target.value)} required type="email" value={confirmationEmail} /></label>
        <label>삭제 확인 문구<input aria-label="삭제 확인 문구" name="confirmationPhrase" onChange={(event) => setConfirmationPhrase(event.target.value)} placeholder="계정 삭제" required value={confirmationPhrase} /></label>
        <label>비밀번호 (최근 로그인 후 5분이 지났다면 필요)<input aria-label="삭제 비밀번호" autoComplete="current-password" name="password" type="password" /></label>
        {deleteState.error ? <p className={styles.error} role="alert" aria-live="assertive">{deleteState.error}</p> : null}
        <div className={styles.dialogActions}><button type="button" onClick={() => setDeleteOpen(false)} disabled={deletePending}>취소</button><button className={styles.dangerButton} disabled={!canDelete || deletePending} type="submit">{deletePending ? "삭제 중..." : "계정 삭제"}</button></div>
      </form>
    </section></div> : null}
  </section>;
};
