"use client";

import { useEffect, useRef } from "react";
import { haptic, play, unlockAudio } from "@/lib/fx";
import { attachParticleCanvas, resizeParticleCanvas } from "@/lib/fx/particles";

/**
 * 앱 전체 손맛 장치
 * - 첫 터치에서 오디오를 깨운다 (브라우저 정책)
 * - 모든 버튼·링크를 누르는 순간 작은 금속 스위치 소리 + 짧은 진동 (data-fx="custom" 이면 각자 소리를 낸다)
 * - 파티클을 그릴 화면 전체 캔버스
 */
export function FxRoot() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    attachParticleCanvas(canvasRef.current);
    const onResize = () => resizeParticleCanvas();
    const onDown = (e: PointerEvent) => {
      unlockAudio();
      const target = e.target;
      if (!(target instanceof Element) || target.closest('[data-fx="custom"]')) return;
      const el = target.closest('button, a[href], [role="button"], summary');
      if (!el || (el as HTMLButtonElement).disabled) return;
      play("tap");
      haptic("tap");
    };
    window.addEventListener("resize", onResize);
    document.addEventListener("pointerdown", onDown, { capture: true, passive: true });
    return () => {
      attachParticleCanvas(null);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("pointerdown", onDown, { capture: true });
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className="pointer-events-none fixed inset-0 z-[70] h-full w-full" />;
}
