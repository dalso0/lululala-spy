"use client";

import {
  animate,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useVelocity,
  type PanInfo,
} from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState, type RefObject } from "react";
import { CommsList } from "@/components/CommsFeed";
import { HelpCard } from "@/components/HelpCard";
import { useMyPosts } from "@/hooks/useLive";
import { useSpy } from "@/hooks/useSpy";
import { burstAt, feel, play } from "@/lib/fx";
import { needsCare } from "@/lib/safety";
import { getSpyStore, type Post } from "@/lib/store";

const MISSION_ID = "m2_mirror";

// 거울에 떠오르는 의심의 말 (매번 3개를 무작위로)
const DOUBTS = [
  "망했다",
  "난 안 될 거야",
  "또 실수했어",
  "어차피 못 해",
  "나만 뒤처져",
  "다들 나보다 잘해",
  "왜 이것밖에 못 해",
  "귀찮아… 그냥 포기할래",
];
const SUGGESTIONS = ["포기하지 않는", "충분히 괜찮은", "천천히 가도 되는", "나를 아끼는", "다시 일어나는"];
const BLANK_MAX = 30;
// 말이 떠오르는 자리 (거울 안 중심 좌표 %)
const SLOTS = [
  { x: 34, y: 20 },
  { x: 64, y: 48 },
  { x: 38, y: 76 },
];

function pickDoubts(n = 3) {
  const pool = [...DOUBTS];
  return Array.from({ length: n }, () => pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
}

const blankFrom = (post: Post | null) => post?.text.match(/^나는 (.+) 요원이다$/)?.[1] ?? "";

type Stage = "trap" | "write" | "care" | "shatter" | "done";
type Result = { gained: boolean | null; post: "sending" | "sent" | "error" };

/** 미션 2: 진실의 거울 방 — 의심의 말 3개를 휴지통에 버리고, 나를 지키는 암호를 새기면 거울이 깨진다 */
export function MirrorRoom() {
  const { spyId, clearMission } = useSpy();
  const myPosts = useMyPosts();
  const myMirror = myPosts?.find((p) => p.kind === "mirror") ?? null;

  const [stage, setStage] = useState<Stage>("trap");
  // 이번 판에 떠오른 의심 3개와 그중 버린 것 (id 는 '한 번 더' 할 때 말들을 새로 그리려고)
  const [round, setRound] = useState(() => ({ id: 0, words: pickDoubts(), thrown: [] as string[] }));
  const [selected, setSelected] = useState<string | null>(null);
  const [flying, setFlying] = useState<string | null>(null); // 눌러서 버리기: 휴지통으로 날아가는 중
  const [overTrash, setOverTrash] = useState(false);
  const trashRef = useRef<HTMLButtonElement>(null);

  const [blank, setBlank] = useState<string | null>(null); // null = 아직 안 건드림(전에 새긴 암호로 채움)
  const [engraved, setEngraved] = useState({ text: "", flagged: false });
  const [result, setResult] = useState<Result>({ gained: null, post: "sending" });

  const blankValue = blank ?? blankFrom(myMirror);
  const remaining = round.words.filter((w) => !round.thrown.includes(w)).length;
  const thrown = round.thrown.length;

  // 의심 3개를 다 버리면 암호 새기기로
  useEffect(() => {
    if (stage !== "trap" || remaining > 0) return;
    const t = setTimeout(() => setStage("write"), 750);
    return () => clearTimeout(t);
  }, [stage, remaining]);

  // 거울이 다 깨지면 결과 화면으로
  useEffect(() => {
    if (stage !== "shatter") return;
    const crack = setTimeout(() => feel("glass", "heavy"), 480);
    const dust = setTimeout(() => burstAt(document.querySelector("[data-mirror]"), "pixels", { count: 40, power: 0.9 }), 900);
    const t = setTimeout(() => setStage("done"), 2100);
    return () => {
      clearTimeout(crack);
      clearTimeout(dust);
      clearTimeout(t);
    };
  }, [stage]);

  // 탈출 성공(처음 깬 경우): 종소리 + 반짝이
  useEffect(() => {
    if (stage === "done" && result.gained === true) {
      feel("chime", "success");
      play("sparkle");
    }
  }, [stage, result.gained]);

  const onThrown = (word: string) => {
    setRound((r) => (r.thrown.includes(word) ? r : { ...r, thrown: [...r.thrown, word] }));
    setSelected((s) => (s === word ? null : s));
    setFlying(null);
    setOverTrash(false);
    feel("gulp", "thunk");
    burstAt(trashRef.current, "pixels", { count: 22, power: 0.7 });
  };

  const sendPost = async (text: string, flagged: boolean) => {
    setResult((r) => ({ ...r, post: "sending" }));
    try {
      await getSpyStore().submitPost("mirror", text, flagged);
      setResult((r) => ({ ...r, post: "sent" }));
    } catch (e) {
      console.error("[m2] 암호 전송 실패", e);
      setResult((r) => ({ ...r, post: "error" }));
    }
  };

  const recordClear = async () => {
    try {
      const gained = await clearMission(MISSION_ID);
      setResult((r) => ({ ...r, gained }));
    } catch (e) {
      console.error("[m2] 기록 실패", e);
      setResult((r) => ({ ...r, gained: null }));
    }
  };

  const engrave = (e: React.FormEvent) => {
    e.preventDefault();
    const text = `나는 ${blankValue.trim()} 요원이다`;
    const flagged = needsCare(text);
    setEngraved({ text, flagged });
    setResult({ gained: null, post: "sending" });
    feel("stamp", "heavy");
    // 새긴 암호는 모두 선생님 검토 대기로 간다 (선생님이 공개해야 다른 요원에게 보인다)
    void sendPost(text, flagged);
    void recordClear();
    setStage(flagged ? "care" : "shatter");
  };

  const replay = () => {
    setRound((r) => ({ id: r.id + 1, words: pickDoubts(), thrown: [] }));
    setSelected(null);
    setFlying(null);
    setBlank(null);
    setStage("trap");
  };

  return (
    <main className="flex flex-1 flex-col gap-4">
      <nav className="flex items-center justify-between font-mono text-[11px] tracking-widest text-fog">
        <Link href="/dashboard" className="-ml-2 px-2 py-2">
          ‹ 상황판
        </Link>
        <span>MISSION 02</span>
      </nav>

      {stage !== "done" && (
        <header>
          <h1 className="text-xl font-bold">진실의 거울 방</h1>
          <p className="mt-1 text-sm text-zinc-300">
            {stage === "trap"
              ? "거울에 의심의 말들이 스멀스멀 떠오른다. 손가락으로 끌어서 휴지통에 던져라."
              : stage === "write"
                ? "의심이 걷혔다. 이제 거울 속 너에게, 너를 지키는 암호를 새겨라."
                : stage === "care"
                  ? "거울을 깨기 전에, 잠깐."
                  : "거울에 금이 가기 시작한다…"}
          </p>
        </header>
      )}

      {stage === "trap" && (
        <>
          {/* 거울이 화면 남은 높이를 채운다: 작은 폰에서도 휴지통이 화면 밖으로 밀려나지 않게 */}
          <Mirror stage="trap" engravedText="" className="min-h-[220px] max-h-[460px] flex-1">
            {round.words.map(
              (word, i) =>
                !round.thrown.includes(word) && (
                  <DoubtChip
                    key={`${round.id}-${word}`}
                    word={word}
                    slot={SLOTS[i % SLOTS.length]}
                    order={i}
                    selected={selected === word}
                    flyNow={flying === word}
                    trashRef={trashRef}
                    onHoverChange={setOverTrash}
                    onSelect={() => setSelected((s) => (s === word ? null : word))}
                    onThrown={onThrown}
                  />
                ),
            )}
          </Mirror>

          <div className="flex flex-col gap-2">
            <Trash
              trashRef={trashRef}
              open={overTrash || selected !== null}
              selected={selected}
              thrown={thrown}
              onClick={() => {
                if (selected && !flying) setFlying(selected);
              }}
            />
            <p className="text-center font-mono text-xs text-fog">
              버린 의심 {thrown} / 3 · 끌기가 어려우면 말을 누르고 휴지통을 눌러도 돼요
            </p>
          </div>
        </>
      )}

      {(stage === "write" || stage === "care" || stage === "shatter") && (
        <Mirror
          stage={stage}
          engravedText={stage === "write" ? `나는 ${blankValue || "____"} 요원이다` : engraved.text}
          className="aspect-[3/2]"
        />
      )}

      {/* 2단계: 암호 새기기 */}
      {stage === "write" && (
        <motion.form
          onSubmit={engrave}
          className="flex flex-col gap-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <label className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-lg">
            <span>나는</span>
            <input
              value={blankValue}
              onChange={(e) => setBlank(e.target.value.slice(0, BLANK_MAX))}
              placeholder="포기하지 않는"
              autoFocus
              enterKeyHint="done"
              className="min-w-0 flex-1 border-b-2 border-magenta bg-transparent px-1 py-1 text-lg outline-none placeholder:text-zinc-600"
              aria-label="나는 ○○ 요원이다 — 빈칸"
            />
            <span>요원이다</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" onClick={() => setBlank(s)} className="rounded-full border border-line px-3 py-1.5 text-xs text-zinc-300">
                {s}
              </button>
            ))}
          </div>
          <p className="text-xs leading-relaxed text-fog">
            새긴 암호는 선생님이 확인한 뒤 요원명으로 다른 요원들에게 공개될 수 있어요. 이름은 나가지 않아요.
            {myMirror && " 새로 새기면 선생님이 다시 확인해요."}
          </p>
          <button
            type="submit"
            disabled={!blankValue.trim()}
            className="rounded-lg bg-magenta py-4 text-lg font-bold text-ink transition-transform active:scale-[0.98] disabled:opacity-40"
          >
            암호 새기기
          </button>
        </motion.form>
      )}

      {/* 위기 표현이 보이면: 거울을 깨기 전에 도움 연락처부터 */}
      {stage === "care" && (
        <div className="flex flex-col gap-3">
          <HelpCard title="잠깐, 요원. 네 마음이 먼저야" />
          <button type="button" onClick={() => setStage("shatter")} className="rounded-lg border border-line py-3">
            고마워요, 계속할게요
          </button>
        </div>
      )}

      {/* 3단계: 결과 */}
      {stage === "done" && (
        <Escaped
          text={engraved.text}
          flagged={engraved.flagged}
          result={result}
          myPost={myMirror}
          spyId={spyId}
          onRetryPost={() => sendPost(engraved.text, engraved.flagged)}
          onRetryClear={recordClear}
          onReplay={replay}
        />
      )}
    </main>
  );
}

/* ───────── 의심의 말 (끌어서 버리기) ───────── */

function DoubtChip(props: {
  word: string;
  slot: { x: number; y: number };
  order: number;
  selected: boolean;
  /** 눌러서 버리기로 휴지통에 날려 보낼 차례 */
  flyNow: boolean;
  trashRef: RefObject<HTMLButtonElement | null>;
  onHoverChange: (over: boolean) => void;
  onSelect: () => void;
  onThrown: (word: string) => void;
}) {
  const { word, slot, order, selected, flyNow, trashRef, onHoverChange, onSelect, onThrown } = props;

  // 끄는 위치 · 크기 · 투명도는 모션 값으로 직접 다룬다 (놓는 순간 튀지 않게)
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);
  const opacity = useMotionValue(1);
  // 좌우로 빠르게 끌면 그 방향으로 살짝 기운다
  const tilt = useSpring(useTransform(useVelocity(x), [-1400, 0, 1400], [-16, 0, 16], { clamp: true }), {
    stiffness: 260,
    damping: 22,
  });

  const [dragging, setDragging] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const hoverRef = useRef(false);
  const goneRef = useRef(false);

  const setHover = (over: boolean) => {
    if (hoverRef.current === over) return;
    hoverRef.current = over;
    onHoverChange(over);
    if (over) feel("switch", "tick"); // 휴지통 뚜껑이 철컥 열린다
  };

  const isOverTrash = (point: PanInfo["point"]) => {
    const r = trashRef.current?.getBoundingClientRect();
    if (!r) return false;
    const px = point.x - window.scrollX;
    const py = point.y - window.scrollY;
    const pad = 32;
    return px > r.left - pad && px < r.right + pad && py > r.top - pad && py < r.bottom + pad;
  };

  /** 지금 자리에서 휴지통 입구로 포물선을 그리며 쏙 들어간다 */
  const flyIntoTrash = async () => {
    if (goneRef.current) return;
    goneRef.current = true;
    const from = buttonRef.current?.getBoundingClientRect();
    const to = trashRef.current?.getBoundingClientRect();
    if (from && to) {
      const dx = to.left + to.width / 2 - (from.left + from.width / 2);
      const dy = to.top + to.height * 0.4 - (from.top + from.height / 2);
      const x0 = x.get();
      const y0 = y.get();
      const peak = y0 + Math.min(dy, 0) - 42;
      await Promise.all([
        animate(x, x0 + dx, { duration: 0.5, ease: [0.25, 0.8, 0.35, 1] }),
        animate(y, [y0, peak, y0 + dy], { duration: 0.5, times: [0, 0.35, 1], ease: ["easeOut", "easeIn"] }),
        animate(scale, [scale.get(), 1.08, 0.12], { duration: 0.5, times: [0, 0.3, 1] }),
        animate(opacity, [1, 1, 0], { duration: 0.5, times: [0, 0.75, 1] }),
      ]);
    }
    onThrown(word);
  };

  const springBack = () => {
    const spring = { type: "spring" as const, stiffness: 420, damping: 26 };
    animate(x, 0, spring);
    animate(y, 0, spring);
    animate(scale, 1, spring);
  };

  // 눌러서 버리기: 휴지통을 누르면 선택한 말이 날아간다 (최신 함수를 ref 로 들고 있다가 flyNow 가 켜질 때만 실행)
  const flyRef = useRef(flyIntoTrash);
  useEffect(() => {
    flyRef.current = flyIntoTrash;
  });
  useEffect(() => {
    if (flyNow) void flyRef.current();
  }, [flyNow]);

  return (
    <div
      className="absolute"
      style={{
        left: `${slot.x}%`,
        top: `${slot.y}%`,
        transform: "translate(-50%, -50%)",
        // 끄는 동안에는 휴지통보다 위에 보이도록
        zIndex: dragging || flyNow ? 50 : 10,
      }}
    >
      {/* 스멀스멀 떠오르고 둥실둥실 */}
      <motion.div
        initial={{ opacity: 0, filter: "blur(8px)", scale: 0.92 }}
        animate={{ opacity: 1, filter: "blur(0px)", scale: 1, y: dragging || flyNow ? 0 : [0, -6, 0] }}
        transition={{
          opacity: { delay: order * 0.45, duration: 1.1 },
          filter: { delay: order * 0.45, duration: 1.1 },
          scale: { delay: order * 0.45, duration: 1.1 },
          y: dragging || flyNow ? { duration: 0.2 } : { duration: 3.2 + order * 0.5, repeat: Infinity, ease: "easeInOut" },
        }}
      >
        <motion.button
          ref={buttonRef}
          type="button"
          data-fx="custom"
          drag={!flyNow}
          dragMomentum={false}
          style={{ x, y, scale, opacity, rotate: tilt }}
          whileDrag={{ boxShadow: "0 14px 32px rgb(0 0 0 / 0.55), 0 0 22px rgb(255 0 255 / 0.45)" }}
          onDragStart={() => {
            setDragging(true);
            animate(scale, 1.1, { type: "spring", stiffness: 500, damping: 24 });
            feel("tick", "tick");
          }}
          onDrag={(_, info) => setHover(isOverTrash(info.point))}
          onDragEnd={(_, info) => {
            setDragging(false);
            const hit = isOverTrash(info.point);
            setHover(false);
            if (hit) void flyIntoTrash();
            else {
              play("tick", { volume: 0.6 });
              springBack();
            }
          }}
          onTap={() => {
            feel("tick", "select");
            onSelect();
          }}
          aria-pressed={selected}
          aria-label={`${word} — 끌어서 휴지통에 버리거나, 누른 뒤 휴지통을 누르세요`}
          className={`cursor-grab touch-none select-none whitespace-nowrap rounded-full border px-4 py-2 text-[15px] font-bold shadow-lg active:cursor-grabbing ${
            selected ? "border-magenta bg-magenta/25 text-white" : "border-zinc-400/50 bg-black/60 text-zinc-100"
          }`}
        >
          {word}
        </motion.button>
      </motion.div>
    </div>
  );
}

/* ───────── 휴지통 ───────── */

function Trash(props: {
  trashRef: RefObject<HTMLButtonElement | null>;
  open: boolean;
  selected: string | null;
  thrown: number;
  onClick: () => void;
}) {
  const { trashRef, open, selected, thrown, onClick } = props;
  return (
    <motion.button
      ref={trashRef}
      type="button"
      data-fx="custom"
      onClick={onClick}
      animate={{ scale: open ? 1.05 : 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 20 }}
      className="relative flex items-center justify-center gap-3 rounded-xl border-2 border-dashed py-4 transition-colors"
      style={{
        borderColor: open ? "#ff00ff" : "var(--color-line)",
        background: open ? "rgb(255 0 255 / 0.12)" : "transparent",
      }}
      aria-label={selected ? `「${selected}」 휴지통에 버리기` : "휴지통"}
    >
      {/* 말을 삼킬 때마다 꿀꺽 */}
      <motion.span
        key={`icon-${thrown}`}
        className="relative block h-8 w-8"
        initial={thrown ? { scale: 1.3, rotate: -10 } : false}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 520, damping: 11 }}
      >
        <svg
          viewBox="0 0 32 32"
          className="h-8 w-8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          {/* 뚜껑: 말이 다가오면 열린다 */}
          <motion.g
            animate={{ rotate: open ? -32 : 0, y: open ? -2 : 0 }}
            style={{ originX: 0.05, originY: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 18 }}
          >
            <path d="M6 9h20" />
            <path d="M13 9V6h6v3" />
          </motion.g>
          <path d="M8.5 12l1.5 14h12l1.5-14" />
          <path d="M13.5 15.5v7M18.5 15.5v7" />
        </svg>
      </motion.span>
      <span className="font-bold">{selected ? `「${selected}」 버리기` : open ? "여기에 놓아!" : "휴지통"}</span>
    </motion.button>
  );
}

/* ───────── 거울 ───────── */

const MIRROR_BG = "linear-gradient(160deg, #4a4a52 0%, #26262b 38%, #5d5d66 62%, #2b2b30 100%)";

// 금이 시작되는 점과 테두리 점 → 부채꼴 삼각형 조각 12개 (빈틈없이 거울을 덮는다)
const CRACK: [number, number] = [56, 42];
const RIM: [number, number][] = [
  [0, 0], [28, 0], [64, 0], [100, 0], [100, 30], [100, 68],
  [100, 100], [70, 100], [34, 100], [0, 100], [0, 72], [0, 34],
];
const SHARDS = RIM.map((p, i) => {
  const q = RIM[(i + 1) % RIM.length];
  const pts = [CRACK, p, q];
  const cx = (CRACK[0] + p[0] + q[0]) / 3;
  const cy = (CRACK[1] + p[1] + q[1]) / 3;
  return {
    clip: `polygon(${pts.map(([x, y]) => `${x}% ${y}%`).join(", ")})`,
    origin: `${cx}% ${cy}%`,
    drift: (cx - 50) * 2.2,
    spin: (i % 2 ? 1 : -1) * (18 + ((i * 37) % 40)),
  };
});

function Mirror({
  stage,
  engravedText,
  className,
  children,
}: {
  stage: Stage;
  engravedText: string;
  className: string;
  children?: React.ReactNode;
}) {
  const broken = stage === "shatter";
  const surface = (
    <div className="absolute inset-0 overflow-hidden rounded-[28px] border border-zinc-400/30" style={{ background: MIRROR_BG }}>
      <div className="noise absolute inset-0 opacity-30" aria-hidden />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: "linear-gradient(115deg, transparent 30%, rgb(255 255 255 / 0.13) 38%, transparent 47%)" }}
      />
      {stage !== "trap" && (
        <p className="absolute inset-x-6 top-1/2 -translate-y-1/2 text-center font-hand text-3xl font-bold leading-snug text-white [text-shadow:0_0_18px_#ff00ff]">
          {engravedText}
        </p>
      )}
    </div>
  );

  return (
    <div data-mirror className={`relative w-full ${className}`}>
      {/* 깨진 뒤 드러나는 좌표 */}
      {broken && (
        <motion.div
          className="absolute inset-0 grid place-items-center rounded-[28px] border border-magenta/60 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
        >
          <div>
            <p className="font-mono text-xs tracking-widest text-magenta">COORDINATES UNLOCKED</p>
            <p className="mt-2 text-lg font-bold">제3구역 · 감각 탈환 작전</p>
            <p className="font-mono text-sm text-fog">D-Day 12/15 · 오프라인 벙커</p>
          </div>
        </motion.div>
      )}

      {broken ? (
        <>
          {SHARDS.map((s, i) => (
            <motion.div
              key={i}
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ clipPath: s.clip, transformOrigin: s.origin }}
              initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
              animate={{ x: s.drift, y: 520, rotate: s.spin, opacity: 0 }}
              transition={{ delay: 0.55 + i * 0.035, duration: 0.95, ease: "easeIn" }}
            >
              {surface}
            </motion.div>
          ))}
          <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {RIM.map(([x, y], i) => (
              <motion.line
                key={i}
                x1={CRACK[0]}
                y1={CRACK[1]}
                x2={x}
                y2={y}
                stroke="white"
                strokeWidth="1.2"
                vectorEffect="non-scaling-stroke"
                initial={{ pathLength: 0, opacity: 1 }}
                animate={{ pathLength: 1, opacity: [1, 1, 0] }}
                transition={{ duration: 0.5, delay: i * 0.02, opacity: { duration: 0.9, times: [0, 0.6, 1] } }}
              />
            ))}
          </svg>
        </>
      ) : (
        surface
      )}
      {children}
    </div>
  );
}

/* ───────── 결과 ───────── */

function Escaped(props: {
  text: string;
  flagged: boolean;
  result: Result;
  myPost: Post | null;
  spyId: string | null;
  onRetryPost: () => void;
  onRetryClear: () => void;
  onReplay: () => void;
}) {
  const { text, flagged, result, myPost, spyId } = props;
  const status = myPost?.text === text ? myPost.status : null;

  return (
    <section className="flex flex-col gap-4">
      <motion.div
        className="rounded-xl border-2 border-magenta bg-panel p-5 text-center"
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 240, damping: 20 }}
      >
        <p className="font-mono text-xs tracking-widest text-magenta">MIRROR BROKEN</p>
        <h1 className="mt-1 text-2xl font-bold">거울 방 탈출 성공!</h1>
        <p className="mt-3 font-hand text-2xl">“{text}”</p>
        {result.gained === true && <p className="mt-3 font-bold text-magenta">픽셀 조각 +1 · 제3구역 좌표 확보</p>}
        {result.gained === false && <p className="mt-3 text-sm text-zinc-300">이미 탈출한 방이에요. 연습 완료!</p>}
        {result.gained === null && (
          <button type="button" onClick={props.onRetryClear} className="mt-3 rounded-md border border-magenta px-3 py-1.5 text-sm text-magenta">
            본부에 탈출 보고 다시 하기
          </button>
        )}
      </motion.div>

      <div className="rounded-lg border border-line px-4 py-3 text-sm">
        {result.post === "error" ? (
          <p className="text-zinc-300">
            암호를 본부에 보내지 못했어요.{" "}
            <button type="button" onClick={props.onRetryPost} className="text-magenta underline">
              다시 보내기
            </button>
          </p>
        ) : (
          <p className="text-zinc-300">
            <StatusChip status={status ?? (result.post === "sent" ? "pending" : null)} /> 선생님이 확인하면 요원명으로 다른
            요원들에게 공개돼요.
          </p>
        )}
      </div>

      {flagged && <HelpCard title="언제든 이야기해도 돼요" />}

      <CommsList kind="mirror" exceptAuthor={spyId} />

      <div className="flex gap-2">
        <button type="button" onClick={props.onReplay} className="flex-1 rounded-lg border border-line py-4 font-bold">
          한 번 더
        </button>
        <Link href="/dashboard" className="flex-1 rounded-lg bg-magenta py-4 text-center font-bold text-ink">
          상황판으로
        </Link>
      </div>
    </section>
  );
}

function StatusChip({ status }: { status: Post["status"] | null }) {
  if (!status) return <span className="font-mono text-xs text-fog">[전송 중]</span>;
  const label = { pending: "검토 중", approved: "공개됨", rejected: "비공개 처리" }[status];
  return (
    <span className={`mr-1 rounded px-1.5 py-0.5 font-mono text-xs ${status === "approved" ? "bg-magenta text-ink" : "border border-line text-fog"}`}>
      {label}
    </span>
  );
}
