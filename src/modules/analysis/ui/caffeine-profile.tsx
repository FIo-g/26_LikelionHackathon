"use client";

import { useActionState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { previewCaffeineWhatIfAction, type CaffeineWhatIfActionState } from "@/app/(app)/analyze/actions";
import { writeRecordDraft } from "@/modules/records/ui/record-form-shell";
import type { CaffeineProfileViewModel } from "../application/get-analyze-view-model";
import styles from "./analyze.module.css";

const initialState: CaffeineWhatIfActionState = { status: "idle" };

export const CaffeineProfile = ({ model }: { model: CaffeineProfileViewModel }) => {
  const [state, formAction, pending] = useActionState(previewCaffeineWhatIfAction, initialState);
  const router = useRouter();

  const recordActualValues = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const form = event.currentTarget.closest("form");
    if (!form || state.status !== "success") return;

    const data = new FormData(form);
    writeRecordDraft(state.actualRecordHref, {
      step: "confirm",
      values: {
        brand: "직접 입력",
        product: "카페인",
        caffeineMg: String(data.get("caffeineMg") ?? ""),
        consumedAt: String(data.get("consumedAt") ?? ""),
      },
    });
    router.push(state.actualRecordHref);
  };

  return (
    <section aria-labelledby="caffeine-title" className={styles.caffeineSection}>
      <div className={styles.sectionHeading}>
        <p className={styles.eyebrow}>카페인 프로필</p>
        <h2 id="caffeine-title">{model.wording}</h2>
      </div>
      <p className={styles.signalValue}>{model.signal === null ? "기록 필요" : `${model.signal}점`}</p>
      <p>기록된 시간과 양에서 보이는 패턴만 미리 살펴봅니다.</p>
      {model.whatIfEnabled ? (
        <form action={formAction} aria-busy={pending} className={styles.whatIfForm}>
          <label>
            카페인 양 (mg)
            <input defaultValue="100" max="1000" min="0" name="caffeineMg" required type="number" />
          </label>
          <label>
            섭취 시간
            <input name="consumedAt" required type="datetime-local" />
          </label>
          <button disabled={pending} type="submit">{pending ? "계산 중" : "기록 전 미리보기"}</button>
          {state.status === "error" ? <p aria-live="polite" className={styles.errorMessage} role="status">{state.message}</p> : null}
          {state.status === "success" ? (
            <div className={styles.previewResult} aria-live="polite">
              <strong>기록 저장 전 영향 미리보기</strong>
              <p>준비도 {state.beforeReadiness ?? "기록 필요"}점에서 {state.afterReadiness ?? "기록 필요"}점</p>
              <p>변화: {state.delta === null ? "계산 불가" : `${state.delta}점`}</p>
              <a href={state.actualRecordHref} onClick={recordActualValues}>실제 기록으로 추가</a>
            </div>
          ) : null}
        </form>
      ) : (
        <p className={styles.emptyState}>최근 분석이 준비되면 기록 전 미리보기를 사용할 수 있어요.</p>
      )}
    </section>
  );
};
