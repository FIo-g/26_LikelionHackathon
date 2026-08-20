"use client";

import { useEffect, useRef, useState } from "react";
import { completeCareToolAction, startCareToolAction } from "@/app/(app)/care/actions";
import styles from "./care.module.css";

type AudioGraph = { context: AudioContext; source: AudioBufferSourceNode; gain: GainNode };

export const WhiteNoisePlayer = ({ localDate }: { localDate: string }) => {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [starting, setStarting] = useState(false);
  const [deadlineAt, setDeadlineAt] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const graph = useRef<AudioGraph | null>(null);
  const sessionId = useRef<string | null>(null);
  const activeElapsedMs = useRef(0);
  const activeStartedAt = useRef<number | null>(null);
  const completing = useRef(false);
  const startInFlight = useRef(false);
  const mounted = useRef(true);

  const cleanup = () => {
    const active = graph.current;
    if (!active) return;
    graph.current = null;
    try { active.source.stop(); } catch {}
    try { active.source.disconnect(); } catch {}
    try { active.gain.disconnect(); } catch {}
    void active.context.close().catch(() => undefined);
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      sessionId.current = null;
      completing.current = false;
      startInFlight.current = false;
      activeStartedAt.current = null;
      cleanup();
    };
  }, []);

  const elapsedMs = () => activeElapsedMs.current + (activeStartedAt.current === null ? 0 : performance.now() - activeStartedAt.current);

  const completeNaturally = async () => {
    const finishedSessionId = sessionId.current;
    if (!finishedSessionId || completing.current) return;
    sessionId.current = null;
    setHasSession(false);
    completing.current = true;
    activeStartedAt.current = null;
    activeElapsedMs.current = 900_000;
    setDeadlineAt(null);
    setElapsed(900);
    setRunning(false);
    cleanup();
    try {
      const result = await completeCareToolAction({ sessionId: finishedSessionId });
      if (!result.ok) setMessage(result.message ?? "완료 기록을 저장하지 못했어요.");
    } catch {
      setMessage("완료 기록을 저장하지 못했어요.");
    } finally {
      completing.current = false;
    }
  };

  useEffect(() => {
    if (!running || deadlineAt === null) return;
    const update = () => {
      const value = Math.min(900_000, elapsedMs());
      setElapsed(Math.floor(value / 1000));
      if (value >= 900_000) void completeNaturally();
    };
    update();
    const interval = window.setInterval(update, 250);
    const deadline = window.setTimeout(() => void completeNaturally(), Math.max(0, deadlineAt - performance.now()));
    return () => { window.clearInterval(interval); window.clearTimeout(deadline); };
  }, [running, deadlineAt]);

  const pause = async () => {
    const active = graph.current;
    if (!active || starting) return;
    try {
      await active.context.suspend();
      if (graph.current !== active) return;
      activeElapsedMs.current = Math.min(900_000, elapsedMs());
      activeStartedAt.current = null;
      setDeadlineAt(null);
      setElapsed(Math.floor(activeElapsedMs.current / 1000));
      setRunning(false);
    } catch {
      setMessage("백색소음을 일시정지하지 못했어요.");
    }
  };

  const resume = async () => {
    const active = graph.current;
    if (!active || starting) return;
    try {
      await active.context.resume();
      if (graph.current !== active) return;
      const resumedAt = performance.now();
      activeStartedAt.current = resumedAt;
      setDeadlineAt(resumedAt + Math.max(0, 900_000 - activeElapsedMs.current));
      setRunning(true);
    } catch {
      setMessage("백색소음을 다시 시작하지 못했어요.");
    }
  };

  const start = async () => {
    if (startInFlight.current || sessionId.current || graph.current) return;
    startInFlight.current = true;
    setStarting(true);
    setMessage(null);
    let context: AudioContext | null = null;
    let graphPrepared = false;
    try {
      const Audio = window.AudioContext;
      if (!Audio) {
        setMessage("이 브라우저에서는 백색소음을 지원하지 않아요.");
        return;
      }
      context = new Audio();
      const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
      const source = context.createBufferSource();
      const gain = context.createGain();
      gain.gain.value = 0.08;
      source.buffer = buffer;
      source.loop = true;
      source.connect(gain);
      gain.connect(context.destination);
      graph.current = { context, source, gain };
      graphPrepared = true;

      const result = await startCareToolAction({ localDate, toolKey: "white-noise", plannedDurationSeconds: 900 });
      if (!mounted.current || !result.ok || !result.sessionId) {
        cleanup();
        if (mounted.current) setMessage(result.message ?? "도구를 시작하지 못했어요.");
        return;
      }
      source.start();
      const startedAt = performance.now();
      sessionId.current = result.sessionId;
      setHasSession(true);
      activeElapsedMs.current = 0;
      activeStartedAt.current = startedAt;
      setDeadlineAt(startedAt + 900_000);
      setElapsed(0);
      setRunning(true);
    } catch {
      if (graphPrepared) cleanup();
      else if (context) void context.close().catch(() => undefined);
      if (mounted.current) setMessage("도구를 시작하지 못했어요.");
    } finally {
      startInFlight.current = false;
      if (mounted.current) setStarting(false);
    }
  };

  const stop = () => {
    if (startInFlight.current) return;
    setRunning(false);
    sessionId.current = null;
    setHasSession(false);
    completing.current = false;
    activeStartedAt.current = null;
    activeElapsedMs.current = 0;
    setDeadlineAt(null);
    setElapsed(0);
    cleanup();
  };

  return (
    <article className={styles.toolCard} aria-busy={starting} data-testid="white-noise-player" data-deadline-at={deadlineAt ?? ""}>
      <div className={styles.toolCardHeader}>
        <span className={styles.toolIcon} aria-hidden="true">○</span>
        <div className={styles.toolCopy}>
          <h3>백색소음</h3>
          <p>최대 15분 타이머</p>
        </div>
      </div>
      <div
        className={styles.toolProgress}
        aria-label="백색소음 진행"
        aria-live="polite"
        aria-valuemax={900}
        aria-valuemin={0}
        aria-valuenow={elapsed}
        role="progressbar"
      >
        <div className={styles.toolProgressHeader}>
          <span className={styles.toolProgressLabel}>{running ? "재생 중" : hasSession ? "일시정지" : "준비됨"}</span>
          <span className={styles.toolProgressValue}>{elapsed}초 / 15분</span>
        </div>
        <span className={styles.toolProgressTrack} aria-hidden="true">
          <span className={styles.toolProgressFill} style={{ width: `${(elapsed / 900) * 100}%` }} />
        </span>
      </div>
      <div className={styles.toolControls}>
        <button className={styles.toolPrimaryAction} disabled={starting} onClick={() => { if (running) { void pause(); return; } if (hasSession) { void resume(); return; } void start(); }} type="button">
          {starting ? "시작 중" : running ? "일시정지" : hasSession ? "이어하기" : "시작"}
        </button>
        <button className={styles.toolSecondaryAction} disabled={starting} onClick={stop} type="button">멈추기</button>
      </div>
      {message ? <p className={styles.toolAlert} role="alert">{message}</p> : null}
    </article>
  );
};
