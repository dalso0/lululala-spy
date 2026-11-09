"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSpy } from "@/hooks/useSpy";
import { CIPHER_LINES, DAILY_ORDERS } from "@/lib/daily";
import { burstAt, feel, haptic, play } from "@/lib/fx";
import { SENSE_NAMES } from "@/lib/missions";
import { getSpyStore } from "@/lib/store";

type Phase =
  | { phase: "pick" }
  | { phase: "saving" }
  | { phase: "reported"; gained: boolean; count: number; fromIndex: number }
  | { phase: "error" };

/** 제1구역 평범지령: 오늘 해낸 평범한 일을 체크해 보고 → 첫 픽셀 + 방화벽 게이지 + 수장 늘곰의 암호 지령 해독 */
export function DailyOrders() {
  const { spy } = useSpy();
  const done = spy.dailyDone;
  const [picked, setPicked] = useState<string[]>([]);
  const [state, setState] = useState<Phase>({ phase: "pick" });
  const resultRef = useRef<HTMLElement>(null);

  // 보고 결과가 화면 아래에 생기므로 그쪽으로 부드럽게 내려 준다
  useEffect(() => {
    if (state.phase !== "reported") return;
    resultRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (!state.gained) return;
    // 첫 픽셀: 스크롤이 멈출 즈음 결과 카드에서 픽셀이 터진다
    const t = setTimeout(() => burstAt(resultRef.current, "pixels", { count: 56 }), 450);
    return () => clearTimeout(t);
  }, [state]);

  const total = DAILY_ORDERS.length;
  const decrypted = Math.min(done.length, CIPHER_LINES.length);
  const allDone = done.length >= total;
  const fromIndex = state.phase === "reported" ? state.fromIndex : decrypted;

  const toggle = (id: string) => {
    if (done.includes(id)) return;
    play("switch");
    haptic("select");
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
    if (state.phase === "reported" || state.phase === "error") setState({ phase: "pick" });
  };

  const report = async () => {
    const before = decrypted;
    feel("thunk", "thunk");
    setState({ phase: "saving" });
    try {
      const gained = await getSpyStore().recordDaily(picked);
      setState({ phase: "reported", gained, count: picked.length, fromIndex: before });
      setPicked([]);
      if (gained) {
        feel("chime", "success");
        play("sparkle");
      } else {
        feel("latch", "unlock");
      }
    } catch (e) {
      console.error("[m0] 보고 실패", e);
      setState({ phase: "error" });
    }
  };

  return (
    <main className="flex flex-1 flex-col gap-5">
      <nav className="flex items-center justify-between font-mono text-[11px] tracking-widest text-fog">
        <Link href="/dashboard" className="-ml-2 px-2 py-2">
          ‹ 상황판
        </Link>
        <span>ZONE 01 · ORDER 00</span>
      </nav>

      <header>
        <h1 className="text-xl font-bold">평범지령 · 일상의 위장술</h1>
        <p className="mt-2 rounded-md border border-line bg-panel px-3 py-2 font-mono text-xs leading-relaxed text-zinc-300">
          <span className="text-magenta">본부 AI ▸ </span>
          적들의 눈을 속이려면 가장 완벽한 &lsquo;평범함&rsquo;으로 위장하라. 오늘 해낸 평범지령을 체크해 본부에 보고하라.
        </p>
      </header>

      <FirewallGauge filled={done.length} total={total} />

      {/* 평범지령 체크리스트 */}
      <section aria-label="평범지령 목록" className="flex flex-col gap-2">
        {DAILY_ORDERS.map((order) => {
          const isDone = done.includes(order.id);
          const isPicked = picked.includes(order.id);
          const on = isDone || isPicked;
          return (
            <label
              key={order.id}
              data-fx="custom"
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 transition-colors ${
                isDone ? "border-line opacity-60" : isPicked ? "border-magenta bg-magenta/10" : "border-line active:bg-white/5"
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={on}
                disabled={isDone || state.phase === "saving"}
                onChange={() => toggle(order.id)}
              />
              <span
                aria-hidden
                className="grid h-7 w-7 shrink-0 place-items-center rounded-md border-2 transition-colors"
                style={{ borderColor: on ? "#ff00ff" : "var(--color-line)", background: on ? "#ff00ff" : "transparent" }}
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="#0e0e10" strokeWidth="3" strokeLinecap="round">
                  <motion.path
                    d="M4 10.5l4 4 8-9"
                    initial={false}
                    animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }}
                    transition={{ duration: 0.25 }}
                  />
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold">{order.title}</span>
                <span className="block text-xs text-fog">
                  {SENSE_NAMES[order.sense]} · {order.hint}
                </span>
              </span>
              {isDone && <span className="shrink-0 font-mono text-[10px] text-fog">보고 완료</span>}
            </label>
          );
        })}
      </section>

      {!allDone && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={report}
            disabled={picked.length === 0 || state.phase === "saving"}
            className="rounded-lg bg-magenta py-4 text-lg font-bold text-ink transition-transform active:scale-[0.98] disabled:opacity-40"
          >
            {state.phase === "saving" ? "본부에 보고 중…" : `완료 · 본부에 보고${picked.length ? ` (${picked.length})` : ""}`}
          </button>
          <p className="text-center text-xs text-fog">
            스스로 해낸 것만 체크하기 · 하나만 해도 돼요. 다른 날 또 와서 더 보고할 수 있어요.
          </p>
          {state.phase === "error" && (
            <p className="text-center text-sm text-magenta">보고하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.</p>
          )}
        </div>
      )}

      {/* 보고 결과 */}
      <AnimatePresence>
        {state.phase === "reported" && (
          <motion.section
            ref={resultRef}
            role="status"
            className="rounded-xl border-2 border-magenta bg-panel p-4 text-center"
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            {state.gained ? (
              <>
                <motion.div
                  className="mx-auto h-9 w-9 rounded-[3px] bg-magenta shadow-[0_0_24px_#ff00ff]"
                  initial={{ rotate: -45, scale: 0 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ delay: 0.15, type: "spring" }}
                />
                <p className="mt-2 font-mono text-xs tracking-widest text-magenta">FIREWALL BREACHED</p>
                <p className="mt-1 text-lg font-bold">방화벽 돌파! 첫 픽셀 조각 +1</p>
                <p className="mt-1 text-sm text-zinc-300">제2구역 지령이 열렸다. 상황판에서 색이 돌아오는지 확인하라.</p>
              </>
            ) : (
              <>
                <p className="font-mono text-xs tracking-widest text-magenta">REPORT RECEIVED</p>
                <p className="mt-1 font-bold">평범지령 {state.count}개 추가 보고 · 늘곰의 암호 지령 해독 진행</p>
              </>
            )}
            <Link href="/dashboard" className="mt-3 inline-block rounded-lg bg-magenta px-6 py-3 font-bold text-ink">
              상황판으로
            </Link>
          </motion.section>
        )}
      </AnimatePresence>

      {/* 수장 늘곰의 암호 지령 */}
      <section aria-label="수장 늘곰의 암호 지령" className="rounded-lg border border-line bg-panel/60 p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-mono text-[11px] tracking-widest text-fog">수장 늘곰의 암호 지령</h2>
          <span className="font-mono text-[11px] text-fog">
            해독 {decrypted}/{CIPHER_LINES.length}
          </span>
        </div>
        <ol className="mt-2 flex flex-col gap-1.5 font-mono text-[13px] leading-relaxed">
          {CIPHER_LINES.map((line, i) =>
            i < decrypted ? (
              <li key={i} className={i >= fromIndex ? "text-magenta" : "text-zinc-200"}>
                {i >= fromIndex ? <Decrypt text={line} delay={(i - fromIndex) * 350} /> : line}
              </li>
            ) : (
              <li key={i} className="flex select-none flex-wrap gap-1.5 py-1" aria-label="아직 해독되지 않음">
                {redactedWords(line).map((w, k) => (
                  <span key={k} className="h-3 animate-pulse rounded-sm bg-zinc-700/80" style={{ width: `${w}ch` }} />
                ))}
              </li>
            ),
          )}
        </ol>
        {allDone && <p className="mt-3 text-sm text-zinc-300">모든 평범지령 완료! 늘곰의 암호 지령을 끝까지 해독했다.</p>}
      </section>
    </main>
  );
}

// 해독 중 잠깐 보이는 기호 (고정폭 글꼴에 다 있는 것만)
const GLYPHS = "#%&@$*+=?";

/** 아직 못 푼 문장: 단어 길이만큼 검은 줄로 가린다 (기밀 문서처럼) */
const redactedWords = (line: string) =>
  line
    .replace(/…/g, "")
    .split(" ")
    .filter(Boolean)
    .map((w) => Math.max(2, w.length * 1.6));

/** 암호가 풀리는 연출: 기호가 앞에서부터 글자로 바뀐다 (무작위 없이 프레임마다 바뀌는 기호) */
function Decrypt({ text, delay = 0 }: { text: string; delay?: number }) {
  const [frame, setFrame] = useState(0);
  const steps = 18;

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    let f = 0;
    const timer = setTimeout(() => {
      interval = setInterval(() => {
        f += 1;
        setFrame(f);
        if (f % 2 === 0) play("tick", { volume: 0.45 }); // 텔레타이프처럼 따각따각
        if (f >= steps) clearInterval(interval);
      }, 45);
    }, delay);
    return () => {
      clearTimeout(timer);
      if (interval) clearInterval(interval);
    };
  }, [delay]);

  const shown = Math.floor((text.length * frame) / steps);
  return (
    <span aria-label={text}>
      {[...text].map((ch, i) => (i < shown || ch === " " || ch === "…" ? ch : GLYPHS[(i * 7 + frame) % GLYPHS.length])).join("")}
    </span>
  );
}

function FirewallGauge({ filled, total }: { filled: number; total: number }) {
  const pct = Math.round((Math.min(filled, total) / total) * 100);
  return (
    <section aria-label={`방화벽 해킹 ${pct}%`} className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between font-mono text-[11px] text-fog">
        <span>방화벽 해킹</span>
        <span className={filled > 0 ? "text-magenta" : ""}>{pct}%</span>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: total }, (_, i) => (
          <motion.span
            key={i}
            className="h-2.5 flex-1 rounded-[2px]"
            initial={false}
            animate={{
              backgroundColor: i < filled ? "#ff00ff" : "#2c2c31",
              boxShadow: i < filled ? "0 0 8px #ff00ff88" : "0 0 0px #00000000",
            }}
            transition={{ delay: i < filled ? i * 0.06 : 0, duration: 0.3 }}
          />
        ))}
      </div>
    </section>
  );
}
