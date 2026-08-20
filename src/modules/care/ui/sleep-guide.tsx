"use client";

import { useEffect, useRef, useState } from "react";
import { completeCareToolAction, startCareToolAction } from "@/app/(app)/care/actions";
import { elapsedMilliseconds } from "../domain/elapsed-time";
import { SLEEP_GUIDE_STEPS } from "../domain/tool-catalog";
import styles from "./care.module.css";

const DURATION_SECONDS = 300;
const DURATION_MS = DURATION_SECONDS * 1000;

export const SleepGuide = ({ localDate }: { localDate: string }) => {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const sessionId = useRef<string | null>(null);
  const completedSegmentsMs = useRef(0);
  const activeStartedAtMs = useRef<number | null>(null);
  const completing = useRef(false);
  const startInFlight = useRef(false);
  const mounted = useRef(true);
  const currentElapsedMs = () => elapsedMilliseconds(completedSegmentsMs.current, activeStartedAtMs.current, performance.now());

  useEffect(() => {
    if (!running) return;
    const update = () => setElapsed(Math.min(DURATION_SECONDS, Math.floor(currentElapsedMs() / 1000)));
    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [running]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false; sessionId.current = null; completing.current = false;
      startInFlight.current = false; activeStartedAtMs.current = null;
    };
  }, []);
  useEffect(() => {
    if (elapsed < DURATION_SECONDS || !sessionId.current || completing.current) return;
    const finishedSessionId = sessionId.current;
    sessionId.current = null; setHasSession(false); completing.current = true; activeStartedAtMs.current = null;
    completedSegmentsMs.current = DURATION_MS; setRunning(false);
    void completeCareToolAction({ sessionId: finishedSessionId })
      .then((result) => { if (!result.ok && mounted.current) setMessage(result.message ?? "완료 기록을 저장하지 못했어요."); })
      .catch(() => { if (mounted.current) setMessage("완료 기록을 저장하지 못했어요."); })
      .finally(() => { completing.current = false; });
  }, [elapsed]);

  const step = [...SLEEP_GUIDE_STEPS].reverse().find((item) => item.startsAtSeconds <= elapsed) ?? SLEEP_GUIDE_STEPS[0];
  const start = async () => {
    if (startInFlight.current || sessionId.current) return;
    startInFlight.current = true; setStarting(true); setMessage(null);
    try {
      const result = await startCareToolAction({ localDate, toolKey: "sleep-guide", plannedDurationSeconds: DURATION_SECONDS });
      if (!mounted.current) return;
      if (!result.ok || !result.sessionId) { setMessage(result.message ?? "시작하지 못했어요."); return; }
      sessionId.current = result.sessionId; setHasSession(true); completedSegmentsMs.current = 0;
      activeStartedAtMs.current = performance.now(); setElapsed(0); setRunning(true);
    } catch {
      if (mounted.current) setMessage("시작하지 못했어요.");
    } finally {
      startInFlight.current = false; if (mounted.current) setStarting(false);
    }
  };
  const pause = () => {
    completedSegmentsMs.current = Math.min(DURATION_MS, currentElapsedMs());
    activeStartedAtMs.current = null; setElapsed(Math.floor(completedSegmentsMs.current / 1000)); setRunning(false);
  };
  const stop = () => {
    if (startInFlight.current) return;
    setRunning(false); setElapsed(0); sessionId.current = null; completing.current = false;
    setHasSession(false);
    completedSegmentsMs.current = 0; activeStartedAtMs.current = null;
  };

  return (
    <article className={styles.toolCard} aria-busy={starting}>
      <div className={styles.toolCardHeader}>
        <span className={styles.toolIcon} aria-hidden="true">~</span>
        <div className={styles.toolCopy}>
          <h3>5분 이완</h3>
          <p>5단계 몸 이완 가이드 · 5분</p>
        </div>
      </div>
      <p className={`${styles.toolGuidance} ${styles.sleepGuideGuidance}`} aria-live="polite">
        <strong>현재 안내</strong>
        <span>{step.label}</span>
      </p>
      <div
        className={`${styles.toolProgress} ${styles.sleepGuideProgress}`}
        aria-label="5분 이완 진행"
        aria-valuemax={DURATION_SECONDS}
        aria-valuemin={0}
        aria-valuenow={elapsed}
        role="progressbar"
      >
        <div className={styles.toolProgressHeader}>
          <span className={styles.toolProgressLabel}>{running ? "진행 중" : hasSession ? "일시정지" : "준비됨"}</span>
          <span className={styles.toolProgressValue}>{elapsed}초 / 5분</span>
        </div>
        <span className={styles.toolProgressTrack} aria-hidden="true">
          <span className={styles.toolProgressFill} style={{ width: `${(elapsed / DURATION_SECONDS) * 100}%` }} />
        </span>
      </div>
      <div className={styles.toolControls}>
        <button className={styles.toolPrimaryAction} disabled={starting} onClick={() => { if (running) pause(); else if (hasSession) { activeStartedAtMs.current = performance.now(); setRunning(true); } else void start(); }} type="button">
          {starting ? "시작 중" : running ? "일시정지" : hasSession ? "이어하기" : "시작"}
        </button>
        <button className={styles.toolSecondaryAction} disabled={starting} onClick={stop} type="button">멈추기</button>
      </div>
      {message ? <p className={styles.toolAlert} role="alert">{message}</p> : null}
    </article>
  );
};
