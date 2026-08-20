"use client";

import { createMajorEventAction } from "@/app/(app)/plan/actions";
import { RecordFormShell } from "@/modules/records/ui/record-form-shell";
import styles from "./plan.module.css";

type MajorEventFormProps = Readonly<{
  formId?: string;
  titleId?: string;
}>;

export const MajorEventForm = ({ formId = "major-event-form", titleId = "major-event-title" }: MajorEventFormProps) => (
  <section className={styles.eventFormCard} id={formId} aria-labelledby={titleId}>
    <p className={styles.eyebrow}>직접 입력</p>
    <h2 id={titleId}>주요 일정 추가</h2>
    <p>이 일정은 계획을 바로 바꾸지 않아요. 먼저 조정 제안을 확인할 수 있어요.</p>
    <RecordFormShell pathname="/plan" action={createMajorEventAction} successRedirectPath="/plan" submitButtonLabel="주요 일정 추가">
      {({ values, setValue }) => (
        <div className={styles.formFields}>
          <label>일정 이름<input name="title" value={values.title ?? ""} onChange={(event) => setValue("title", event.target.value)} required maxLength={100} /></label>
          <label>일정 유형<input name="type" value={values.type ?? ""} onChange={(event) => setValue("type", event.target.value)} required maxLength={40} placeholder="예: 여행, 시험, 발표" /></label>
          <label>시작 시간<input name="startsAt" type="datetime-local" value={values.startsAt ?? ""} onChange={(event) => setValue("startsAt", event.target.value)} required /></label>
          <label>원하는 기상 시간 (선택)<input name="desiredWakeAt" type="datetime-local" value={values.desiredWakeAt ?? ""} onChange={(event) => setValue("desiredWakeAt", event.target.value)} /></label>
          <label className={styles.fullWidth}>메모 (선택)<textarea name="notes" value={values.notes ?? ""} onChange={(event) => setValue("notes", event.target.value)} maxLength={500} rows={3} /></label>
        </div>
      )}
    </RecordFormShell>
  </section>
);
