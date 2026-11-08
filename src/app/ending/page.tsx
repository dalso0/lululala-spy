"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useGame, useMyPosts } from "@/hooks/useLive";
import { useSpy } from "@/hooks/useSpy";
import { asset } from "@/lib/asset";
import { burst, feel, play } from "@/lib/fx";
import { SENSE_NAMES, sensesOf } from "@/lib/missions";

/**
 * 늘곰 연구소(엔딩). 선생님이 관제실에서 '연구소 열기'를 누르면 모두에게 열린다.
 * (부스를 몇 곳 돌았는지와 상관없이 모두 엔딩을 본다. 감각 고르기 · 안정화 카드는 다음 작업에서 채운다)
 */
export default function EndingPage() {
  const { status, spy } = useSpy();
  const game = useGame();
  const myMirror = useMyPosts()?.find((p) => p.kind === "mirror") ?? null;
  const open = game?.endingOpen === true;

  // 연구소 문이 열리는 순간: 종소리 + 색종이
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      feel("chime", "success");
      play("sparkle");
      burst(window.innerWidth * 0.3, window.innerHeight * 0.35, "confetti");
      burst(window.innerWidth * 0.7, window.innerHeight * 0.35, "confetti");
    }, 400);
    return () => clearTimeout(t);
  }, [open]);

  if (status === "loading" || !game) {
    return <p className="m-auto font-mono text-sm text-fog">연구소 신호 수신 중…</p>;
  }

  if (!game.endingOpen) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <p className="font-mono text-xs tracking-widest text-fog">SIGNAL TOO WEAK</p>
        <p>
          아직 늘곰 연구소의 문이 닫혀 있어요.
          <br />
          D-Day 정리 시간에 본부가 문을 열어 줄 거예요.
        </p>
        <Link href="/dashboard" className="mt-3 rounded-lg border border-line px-5 py-3 text-sm">
          상황판으로
        </Link>
      </main>
    );
  }

  const senses = sensesOf(spy.clearedMissions, spy.dailyDone);

  return (
    <main className="fixed inset-0 flex flex-col items-center justify-center gap-4 overflow-y-auto bg-magenta px-6 text-center text-ink">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={asset("/art/hooray.webp")} alt="두 팔을 번쩍 든 늘곰" className="h-44" />
      <h1 className="font-hand text-4xl font-bold">늘곰 연구소</h1>
      <p className="font-hand text-xl">“고맙다, {spy.codename.split(" #")[0] || "요원"}. 덕분에 돌아왔어.”</p>
      {myMirror && (
        <p className="text-sm">
          네가 거울에 새긴 암호: <b>“{myMirror.text}”</b>
        </p>
      )}
      {senses.length > 0 && (
        <p className="text-sm">
          네가 깨운 감각: <b>{senses.map((s) => SENSE_NAMES[s]).join(" · ")}</b>
        </p>
      )}
      <p className="text-sm opacity-80">(엔딩 퀘스트와 탈출 인증서는 다음 단계에서 열려요)</p>
    </main>
  );
}
