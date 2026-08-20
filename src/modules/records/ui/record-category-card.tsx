"use client";

import Link from "next/link";
import Image from "next/image";
import { useActionState } from "react";
import { deleteRecordBatchAction } from "@/app/(app)/record/actions";
import type { EntryPresence, RecordEditDraft } from "@/modules/records/application/get-record-hub";
import type { RecordType } from "@/modules/records/domain/types";
import { clearRecordDraft, writeRecordDraft } from "./record-form-shell";
import styles from "./records.module.css";

type RecordCategoryCardProps = Readonly<{
  category: string;
  presence: EntryPresence;
  inputMode: "manual";
  summary: string | null;
  href: string;
  records?: readonly { recordId: string; recordType: RecordType }[];
  editDraft?: RecordEditDraft | null;
  featured?: boolean;
}>;

export const RecordCategoryCard = ({
  category,
  presence,
  inputMode,
  summary,
  href,
  records = [],
  editDraft = null,
  featured = false,
}: RecordCategoryCardProps) => {
  const [deleteState, deleteAction, deleting] = useActionState(
    async (_previous: null | Awaited<ReturnType<typeof deleteRecordBatchAction>>, formData: FormData) => {
      formData.set("idempotencyKey", crypto.randomUUID());
      return deleteRecordBatchAction(formData);
    },
    null,
  );
  const isPhoneManual = category.includes("휴대폰") && inputMode === "manual";
  const statusLabel = isPhoneManual
    ? "직접 입력 사용 중"
    : presence === "empty"
      ? "미입력"
      : presence === "draft"
        ? "입력 중"
        : "완료";

  return (
    <article className={`${styles.categoryCard} ${featured ? styles.featuredCard : ""}`}>
      {featured ? (
        <Image
          className={styles.featuredRabbit}
          src="/assets/lunar-rabbit/record-sleep-deprived-rabbit.png"
          alt="피곤한 달토끼"
          width={96}
          height={96}
        />
      ) : null}
      <div className={styles.categorySummary}>
        <span className={styles.categoryIcon} aria-hidden="true">{category.includes("휴대폰") ? "수" : category.slice(0, 1)}</span>
        <div>
          <h3>{category}</h3>
          <p>{summary ?? "아직 기록 없음"}</p>
        </div>
      </div>
      <div className={styles.categoryFooter}>
        <span className={styles.statusPill} data-status={presence}>{statusLabel}</span>
        <div className={styles.categoryActions}>
      <Link className={styles.textAction} href={href} onClick={() => clearRecordDraft(href)}>추가</Link>
      {presence !== "empty" ? (
        <Link
          className={styles.textAction}
          href={href}
          onClick={() => {
            if (editDraft) writeRecordDraft(href, editDraft);
          }}
        >
          수정
        </Link>
      ) : null}
      {presence !== "empty" ? (
        <form
          className={styles.deleteForm}
          action={deleteAction}
          onSubmit={(event) => {
            if (!window.confirm(`${category} 기록을 삭제할까요?`)) event.preventDefault();
          }}
        >
          <input type="hidden" name="items" value={JSON.stringify(records)} />
          <button className={styles.deleteButton} type="submit" disabled={deleting || records.length === 0}>삭제</button>
        </form>
      ) : null}
        </div>
      </div>
      {deleteState?.status === "error" ? <p role="alert">기록을 삭제하지 못했어요.</p> : null}
    </article>
  );
};
