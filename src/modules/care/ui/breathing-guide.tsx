"use client";

import { useEffect, useRef, useState } from "react";
import { completeCareToolAction, startCareToolAction } from "@/app/(app)/care/actions";
import { elapsedMilliseconds } from "../domain/elapsed-time";
import { BREATHING_PHASES } from "../domain/tool-catalog";
import styles from "./care.module.css";

const DURATION_SECONDS = 180;
const DURATION_MS = DURATION_SECONDS * 1000;

export const BreathingGuide = ({ localDate }: { localDate: string }) => {
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
      mounted.current = false;
      sessionId.current = null;
      completing.current = false;
      startInFlight.current = false;
      activeStartedAtMs.current = null;
    };
  }, []);

  useEffect(() => {
    if (elapsed < DURATION_SECONDS || !sessionId.current || completing.current) return;
    const finishedSessionId = sessionId.current;
    sessionId.current = null;
    setHasSession(false);
    completing.current = true;
    activeStartedAtMs.current = null;
    completedSegmentsMs.current = DURATION_MS;
    setRunning(false);
    void completeCareToolAction({ sessionId: finishedSessionId })
      .then((result) => { if (!result.ok && mounted.current) setMessage(result.message ?? "완료 기록을 저장하지 못했어요."); })
      .catch(() => { if (mounted.current) setMessage("완료 기록을 저장하지 못했어요."); })
      .finally(() => { completing.current = false; });
  }, [elapsed]);

  const cycle = elapsed % 12;
  const phase = cycle < 4 ? BREATHING_PHASES[0] : cycle < 6 ? BREATHING_PHASES[1] : BREATHING_PHASES[2];
  const start = async () => {
    if (startInFlight.current || sessionId.current) return;
    startInFlight.current = true;
    setStarting(true);
    setMessage(null);
    try {
      const result = await startCareToolAction({ localDate, toolKey: "breathing", plannedDurationSeconds: DURATION_SECONDS });
      if (!mounted.current) return;
      if (!result.ok || !result.sessionId) { setMessage(result.message ?? "시작하지 못했어요."); return; }
      sessionId.current = result.sessionId;
      setHasSession(true);
      completedSegmentsMs.current = 0;
      activeStartedAtMs.current = performance.now();
      setElapsed(0);
      setRunning(true);
    } catch {
      if (mounted.current) setMessage("시작하지 못했어요.");
    } finally {
      startInFlight.current = false;
      if (mounted.current) setStarting(false);
    }
  };
  const pause = () => {
    completedSegmentsMs.current = Math.min(DURATION_MS, currentElapsedMs());
    activeStartedAtMs.current = null;
    setElapsed(Math.floor(completedSegmentsMs.current / 1000));
    setRunning(false);
  };
  const resume = () => { activeStartedAtMs.current = performance.now(); setRunning(true); };
  const stop = () => {
    if (startInFlight.current) return;
    setRunning(false); setElapsed(0); sessionId.current = null; completing.current = false;
    setHasSession(false);
    completedSegmentsMs.current = 0; activeStartedAtMs.current = null;
  };

  return <article className={styles.toolCard} aria-busy={starting}><h3>호흡 가이드</h3><div aria-label="호흡 가이드 진행" aria-live="polite" aria-valuemax={DURATION_SECONDS} aria-valuemin={0} aria-valuenow={elapsed} role="progressbar">{phase.label} · {elapsed}/{DURATION_SECONDS}초</div><div><button disabled={starting} onClick={() => { if (running) pause(); else if (hasSession) resume(); else void start(); }} type="button">{starting ? "시작 중" : running ? "일시정지" : hasSession ? "이어하기" : "시작"}</button><button disabled={starting} onClick={stop} type="button">멈추기</button></div>{message ? <p role="alert">{message}</p> : null}</article>;
};
