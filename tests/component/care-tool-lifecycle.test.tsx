import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  start: vi.fn(), complete: vi.fn(),
}));

vi.mock("@/app/(app)/care/actions", () => ({
  startCareToolAction: actions.start,
  completeCareToolAction: actions.complete,
}));

import { BreathingGuide } from "@/modules/care/ui/breathing-guide";
import { WhiteNoisePlayer } from "@/modules/care/ui/white-noise-player";

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); actions.start.mockReset(); actions.complete.mockReset(); });

describe("Care tool lifecycle", () => {
  it("derives breathing progress from monotonic elapsed time instead of interval callbacks", async () => {
    vi.useFakeTimers();
    let now = 1_000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    actions.start.mockResolvedValue({ ok: true, sessionId: "breathing-monotonic" });
    render(<BreathingGuide localDate="2026-08-19" />);

    fireEvent.click(screen.getByRole("button", { name: "시작" }));
    await act(async () => { await Promise.resolve(); });
    now = 6_500;
    act(() => { vi.advanceTimersByTime(1_000); });

    expect(screen.getByRole("progressbar", { name: "호흡 가이드 진행" })).toHaveAttribute("aria-valuenow", "5");
    vi.useRealTimers();
  });

  it("clears a stopped breathing session so restart creates a new session", async () => {
    actions.start.mockResolvedValueOnce({ ok: true, sessionId: "session-1" }).mockResolvedValueOnce({ ok: true, sessionId: "session-2" });
    render(<BreathingGuide localDate="2026-08-19" />);

    fireEvent.click(screen.getByRole("button", { name: "시작" }));
    await waitFor(() => expect(actions.start).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "일시정지" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "멈추기" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "시작" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "시작" }));
    await waitFor(() => expect(actions.start).toHaveBeenCalledTimes(2));
    expect(actions.complete).not.toHaveBeenCalled();
  });

  it("pauses, resumes, and tears down white noise without silently dropping completion errors", async () => {
    const suspend = vi.fn().mockResolvedValue(undefined); const resume = vi.fn().mockResolvedValue(undefined); const close = vi.fn().mockResolvedValue(undefined); const stop = vi.fn(); const disconnect = vi.fn();
    class FakeAudioContext { sampleRate = 4; destination = {}; createBuffer = () => ({ getChannelData: () => new Float32Array(4) }); createBufferSource = () => ({ connect: vi.fn(), start: vi.fn(), stop, disconnect, loop: false, buffer: null }); createGain = () => ({ connect: vi.fn(), disconnect, gain: { value: 0 } }); suspend = suspend; resume = resume; close = close; }
    Object.defineProperty(window, "AudioContext", { configurable: true, value: FakeAudioContext });
    actions.start.mockResolvedValue({ ok: true, sessionId: "noise-1" });
    actions.complete.mockResolvedValue({ ok: false, message: "완료 저장 실패" });
    render(<WhiteNoisePlayer localDate="2026-08-19" />);

    fireEvent.click(screen.getByRole("button", { name: "시작" }));
    await waitFor(() => expect(actions.start).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByRole("button", { name: "일시정지" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "일시정지" }));
    await waitFor(() => expect(suspend).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: "이어하기" }));
    await waitFor(() => expect(resume).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: "멈추기" }));
    expect(stop).toHaveBeenCalledOnce();
    expect(disconnect).toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
  });

  it("serializes a delayed breathing start so double activation creates one session", async () => {
    let resolveStart: ((value: { ok: boolean; sessionId: string }) => void) | undefined;
    actions.start.mockImplementation(() => new Promise((resolve) => { resolveStart = resolve; }));
    render(<BreathingGuide localDate="2026-08-19" />);

    const start = screen.getByRole("button", { name: "시작" });
    fireEvent.click(start);
    fireEvent.click(start);

    expect(start).toBeDisabled();
    expect(actions.start).toHaveBeenCalledOnce();
    resolveStart?.({ ok: true, sessionId: "session-delayed" });
    await waitFor(() => expect(screen.getByRole("button", { name: "멈추기" })).toBeInTheDocument());
  });

  it("starts white noise once at the accepted audio deadline and releases a rejected start graph", async () => {
    const sourceStart = vi.fn(); const sourceStop = vi.fn(); const sourceDisconnect = vi.fn(); const gainDisconnect = vi.fn(); const close = vi.fn().mockResolvedValue(undefined);
    class FakeAudioContext { sampleRate = 4; destination = {}; createBuffer = () => ({ getChannelData: () => new Float32Array(4) }); createBufferSource = () => ({ connect: vi.fn(), start: sourceStart, stop: sourceStop, disconnect: sourceDisconnect, loop: false, buffer: null }); createGain = () => ({ connect: vi.fn(), disconnect: gainDisconnect, gain: { value: 0 } }); suspend = vi.fn().mockResolvedValue(undefined); resume = vi.fn().mockResolvedValue(undefined); close = close; }
    Object.defineProperty(window, "AudioContext", { configurable: true, value: FakeAudioContext });
    let resolveStart: ((value: { ok: boolean; sessionId: string }) => void) | undefined;
    actions.start.mockImplementationOnce(() => new Promise((resolve) => { resolveStart = resolve; }));
    const now = vi.spyOn(performance, "now").mockReturnValue(125);
    render(<WhiteNoisePlayer localDate="2026-08-19" />);

    const start = screen.getByRole("button", { name: "시작" });
    fireEvent.click(start); fireEvent.click(start);
    expect(start).toBeDisabled();
    expect(actions.start).toHaveBeenCalledOnce();
    expect(sourceStart).not.toHaveBeenCalled();
    resolveStart?.({ ok: true, sessionId: "noise-delayed" });
    await waitFor(() => expect(sourceStart).toHaveBeenCalledOnce());
    expect(screen.getByTestId("white-noise-player")).toHaveAttribute("data-deadline-at", "900125");
    now.mockRestore();

    fireEvent.click(screen.getByRole("button", { name: "멈추기" }));
    actions.start.mockRejectedValueOnce(new Error("start rejected"));
    fireEvent.click(screen.getByRole("button", { name: "시작" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("도구를 시작하지 못했어요."));
    expect(sourceStop).toHaveBeenCalled();
    expect(sourceDisconnect).toHaveBeenCalled();
    expect(gainDisconnect).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });

  it("keeps white noise active when suspending the audio context fails", async () => {
    const suspend = vi.fn().mockRejectedValue(new Error("suspend rejected"));
    class FakeAudioContext { sampleRate = 4; destination = {}; createBuffer = () => ({ getChannelData: () => new Float32Array(4) }); createBufferSource = () => ({ connect: vi.fn(), start: vi.fn(), stop: vi.fn(), disconnect: vi.fn(), loop: false, buffer: null }); createGain = () => ({ connect: vi.fn(), disconnect: vi.fn(), gain: { value: 0 } }); suspend = suspend; resume = vi.fn().mockResolvedValue(undefined); close = vi.fn().mockResolvedValue(undefined); }
    Object.defineProperty(window, "AudioContext", { configurable: true, value: FakeAudioContext });
    actions.start.mockResolvedValue({ ok: true, sessionId: "noise-suspend" });
    render(<WhiteNoisePlayer localDate="2026-08-19" />);

    fireEvent.click(screen.getByRole("button", { name: "시작" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "일시정지" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "일시정지" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("일시정지하지 못했어요."));
    expect(screen.getByRole("button", { name: "일시정지" })).toBeInTheDocument();
  });
});
