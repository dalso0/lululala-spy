"use client";

import { useSyncExternalStore } from "react";
import { haptic, isSoundOn, play, setSoundOn, subscribeSound, unlockAudio } from "@/lib/fx";

/** 효과음 켜기/끄기 (수업 중엔 끄기 쉽게). 진동은 소리와 상관없이 그대로 */
export function SoundToggle({ className = "" }: { className?: string }) {
  const on = useSyncExternalStore(subscribeSound, isSoundOn, () => true);

  return (
    <button
      type="button"
      data-fx="custom"
      aria-pressed={on}
      aria-label={on ? "효과음 끄기" : "효과음 켜기"}
      onClick={() => {
        const next = !on;
        setSoundOn(next);
        if (next) {
          unlockAudio();
          play("switch");
        }
        haptic("select");
      }}
      className={`grid h-8 w-8 place-items-center rounded-md border border-line text-zinc-300 ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
        <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none" />
        {on ? (
          <>
            <path d="M15.5 9a4 4 0 010 6" />
            <path d="M18 6.5a7.5 7.5 0 010 11" />
          </>
        ) : (
          <path d="M16 9.5l5 5M21 9.5l-5 5" />
        )}
      </svg>
    </button>
  );
}
