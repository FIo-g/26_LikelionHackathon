"use client";

import { useEffect, useRef, useState } from "react";
import { completeCareToolAction, startCareToolAction } from "@/app/(app)/care/actions";
import { BREATHING_PHASES } from "../domain/tool-catalog";
import styles from "./care.module.css";

export const BreathingGuide = ({ localDate }: { localDate: string }) => {
  const [elapsed, setElapsed] = useState(0); const [running, setRunning] = useState(false); const [starting, setStarting] = useState(false); const [message, setMessage] = useState<string | null>(null); const sessionId = useRef<string | null>(null); const completing = useRef(false); const startInFlight = useRef(false); const mounted = useRef(true);
  useEffect(() => { if (!running) return; const timer = window.setInterval(() => setElapsed((value) => Math.min(180, value + 1)), 1000); return () => window.clearInterval(timer); }, [running]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; sessionId.current = null; completing.current = false; startInFlight.current = false; }; }, []);
  useEffect(() => { if (elapsed !== 180 || !sessionId.current || completing.current) return; const finishedSessionId = sessionId.current; sessionId.current = null; completing.current = true; setRunning(false); void (async () => { try { const result = await completeCareToolAction({ sessionId: finishedSessionId }); if (!result.ok) setMessage(result.message ?? "완료 기록을 저장하지 못했어요."); } catch { setMessage("완료 기록을 저장하지 못했어요."); } finally { completing.current = false; } })(); }, [elapsed]);
  const cycle = elapsed % 12; const phase = cycle < 4 ? BREATHING_PHASES[0] : cycle < 6 ? BREATHING_PHASES[1] : BREATHING_PHASES[2];
  const start = async () => { if (startInFlight.current || sessionId.current) return; startInFlight.current = true; setStarting(true); try { const result = await startCareToolAction({ localDate, toolKey: "breathing", plannedDurationSeconds: 180 }); if (!mounted.current) return; if (!result.ok || !result.sessionId) { setMessage(result.message ?? "시작하지 못했어요."); return; } sessionId.current = result.sessionId; setElapsed(0); setRunning(true); } catch { if (mounted.current) setMessage("시작하지 못했어요."); } finally { startInFlight.current = false; if (mounted.current) setStarting(false); } };
  const stop = () => { if (startInFlight.current) return; setRunning(false); setElapsed(0); sessionId.current = null; completing.current = false; };
  return <article className={styles.toolCard} aria-busy={starting}><h3>호흡 가이드</h3><p aria-live="polite">{phase.label} · {elapsed}/180초</p><div><button disabled={starting} onClick={() => { if (running) { setRunning(false); return; } if (sessionId.current) { setRunning(true); return; } void start(); }} type="button">{starting ? "시작 중" : running ? "일시정지" : sessionId.current ? "이어하기" : "시작"}</button><button disabled={starting} onClick={stop} type="button">멈추기</button></div>{message ? <p role="alert">{message}</p> : null}</article>;
};
