"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ───────────── 호흡 패턴 ───────────── */

export type BreathPhase = "inhale" | "hold" | "exhale";
export type BreathStep = { phase: BreathPhase; seconds: number; label: string };

/** 들숨 4초 → 멈춤 4초 → 날숨 6초 (한 사이클 14초) */
export const CALM_PATTERN: readonly BreathStep[] = [
  { phase: "inhale", seconds: 4, label: "들이쉬기" },
  { phase: "hold", seconds: 4, label: "멈추기" },
  { phase: "exhale", seconds: 6, label: "내쉬기" },
];

export type BreathStatus = "idle" | "running" | "paused" | "done";

export type BreathPosition = {
  /** 지금 몇 번째 사이클인지 (1부터) */
  cycle: number;
  /** 다 끝낸 사이클 수 */
  cyclesDone: number;
  stepIndex: number;
  step: BreathStep;
  /** 현재 단계 진행률 0~1 */
  stepProgress: number;
  /** 현재 단계 남은 초 */
  stepRemaining: number;
  /** 전체 남은 초 */
  totalRemaining: number;
  /** 전체 진행률 0~1 */
  totalProgress: number;
};

const cycleMsOf = (pattern: readonly BreathStep[]) =>
  pattern.reduce((sum, s) => sum + s.seconds * 1000, 0);

/**
 * 경과 시간(ms)만으로 지금 호흡 위치를 계산하는 순수 함수.
 * 타이머 틱 횟수를 세지 않고 실제 경과 시간에서 매번 다시 계산하므로,
 * 폰이 잠깐 버벅여도 시간이 밀리지 않는다.
 */
export function locateBreath(
  elapsedMs: number,
  pattern: readonly BreathStep[],
  cycles: number,
): BreathPosition {
  const cycleMs = cycleMsOf(pattern);
  const totalMs = cycleMs * cycles;
  const t = Math.min(Math.max(elapsedMs, 0), totalMs);
  const finished = t >= totalMs;

  const cyclesDone = finished ? cycles : Math.floor(t / cycleMs);
  const cycleIndex = Math.min(cyclesDone, cycles - 1);
  const inCycle = finished ? cycleMs : t - cycleIndex * cycleMs;

  let stepIndex = pattern.length - 1;
  let stepStart = cycleMs - pattern[stepIndex].seconds * 1000;
  for (let i = 0, acc = 0; i < pattern.length; i++) {
    const len = pattern[i].seconds * 1000;
    if (inCycle < acc + len) {
      stepIndex = i;
      stepStart = acc;
      break;
    }
    acc += len;
  }
  const step = pattern[stepIndex];
  const stepMs = step.seconds * 1000;
  const inStep = Math.min(inCycle - stepStart, stepMs);

  return {
    cycle: cycleIndex + 1,
    cyclesDone,
    stepIndex,
    step,
    stepProgress: inStep / stepMs,
    stepRemaining: (stepMs - inStep) / 1000,
    totalRemaining: (totalMs - t) / 1000,
    totalProgress: t / totalMs,
  };
}

/* ───────────── 훅 ───────────── */

type Options = {
  pattern?: readonly BreathStep[];
  cycles?: number;
  /** 모든 사이클을 끝냈을 때 한 번 호출 */
  onComplete?: () => void;
  /** 들숨/멈춤/날숨이 바뀔 때마다 호출 (진동·소리 신호용) */
  onStepChange?: (step: BreathStep, cycle: number) => void;
  /** 다른 앱으로 넘어가면 자동으로 일시정지 (기본 true) */
  pauseWhenHidden?: boolean;
};

/**
 * 호흡 타이머 상태 관리.
 * idle → running ⇄ paused → done
 *
 * 경과 시간은 `쌓인 시간(base) + (지금 - 이번 실행 시작 시각)`으로 계산하고,
 * 실행 중에만 requestAnimationFrame 으로 화면을 갱신한다.
 */
export function useBreathingCycle({
  pattern = CALM_PATTERN,
  cycles = 3,
  onComplete,
  onStepChange,
  pauseWhenHidden = true,
}: Options = {}) {
  const [status, setStatus] = useState<BreathStatus>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);

  const totalMs = cycleMsOf(pattern) * cycles;

  const baseRef = useRef(0); // 일시정지 전까지 쌓인 시간
  const startedAtRef = useRef(0); // 이번 실행을 시작한 performance.now()
  const runningRef = useRef(false);
  const lastStepKeyRef = useRef("");

  // 콜백은 최신 것을 쓰되, 바뀐다고 타이머를 다시 시작하지 않도록 ref 에 둔다
  const onCompleteRef = useRef(onComplete);
  const onStepChangeRef = useRef(onStepChange);
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onStepChangeRef.current = onStepChange;
  });

  const emitStep = useCallback(
    (ms: number) => {
      const pos = locateBreath(ms, pattern, cycles);
      const key = `${pos.cycle}-${pos.stepIndex}`;
      if (key !== lastStepKeyRef.current) {
        lastStepKeyRef.current = key;
        onStepChangeRef.current?.(pos.step, pos.cycle);
      }
    },
    [pattern, cycles],
  );

  const start = useCallback(() => {
    baseRef.current = 0;
    startedAtRef.current = performance.now();
    runningRef.current = true;
    lastStepKeyRef.current = "";
    setElapsedMs(0);
    setStatus("running");
    emitStep(0);
  }, [emitStep]);

  const pause = useCallback(() => {
    if (!runningRef.current) return;
    runningRef.current = false;
    baseRef.current += performance.now() - startedAtRef.current;
    setElapsedMs(baseRef.current);
    setStatus("paused");
  }, []);

  const resume = useCallback(() => {
    if (runningRef.current || baseRef.current >= totalMs) return;
    startedAtRef.current = performance.now();
    runningRef.current = true;
    setStatus("running");
  }, [totalMs]);

  const reset = useCallback(() => {
    runningRef.current = false;
    baseRef.current = 0;
    lastStepKeyRef.current = "";
    setElapsedMs(0);
    setStatus("idle");
  }, []);

  // 실행 중일 때만 프레임마다 경과 시간 갱신
  useEffect(() => {
    if (status !== "running") return;
    let raf = 0;
    const tick = () => {
      const ms = baseRef.current + (performance.now() - startedAtRef.current);
      if (ms >= totalMs) {
        runningRef.current = false;
        baseRef.current = totalMs;
        setElapsedMs(totalMs);
        setStatus("done");
        onCompleteRef.current?.();
        return;
      }
      setElapsedMs(ms);
      emitStep(ms);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status, totalMs, emitStep]);

  // 화면을 벗어나면 일시정지 (안 보는 사이에 폭탄이 해체되는 일 방지)
  useEffect(() => {
    if (!pauseWhenHidden || status !== "running") return;
    const onVisibility = () => {
      if (document.hidden) pause();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [pauseWhenHidden, status, pause]);

  const position = useMemo(
    () => locateBreath(elapsedMs, pattern, cycles),
    [elapsedMs, pattern, cycles],
  );

  return {
    status,
    ...position,
    cycles,
    totalSeconds: totalMs / 1000,
    start,
    pause,
    resume,
    reset,
  };
}
