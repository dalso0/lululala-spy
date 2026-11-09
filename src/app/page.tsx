"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { IdCard } from "@/components/IdCard";
import { useSpy } from "@/hooks/useSpy";
import { isFirebaseConfigured } from "@/lib/firebase";
import { burst, feel } from "@/lib/fx";
import { getSpyStore, RESTORE_MESSAGES, RestoreError } from "@/lib/store";

const LINES = [
  "> 합천중학교 전역에 회색 안개 감지",
  "> 감염 증상: 하늘색 망각 · 미각 상실 · 잿빛 불안",
  "> 본부 수장 '늘곰', 비밀 지령 발령",
  "> 평범한 스파이 긴급 소집…",
];

type Stage = "boot" | "intro" | "issuing" | "reveal" | "restore" | "welcomeBack";

/** 접속 화면: NFC 키링을 대면 가장 먼저 보는 곳 */
export default function Landing() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("boot");
  const [error, setError] = useState<string | null>(null);

  // 이미 요원 신분이 있으면 바로 상황판으로
  useEffect(() => {
    let alive = true;
    getSpyStore()
      .hasSession()
      .then((has) => {
        if (!alive) return;
        if (has) {
          setStage("welcomeBack");
          setTimeout(() => router.replace("/dashboard"), 900);
        } else {
          setStage("intro");
        }
      })
      .catch(() => alive && setStage("intro"));
    return () => {
      alive = false;
    };
  }, [router]);

  const enter = async () => {
    feel("power", "thunk");
    setStage("issuing");
    setError(null);
    try {
      const { isNew } = await getSpyStore().start(); // 익명 요원 신분 + 요원명 + 복구 코드 발급
      if (isNew) setStage("reveal");
      else router.push("/dashboard");
    } catch (e) {
      console.error(e);
      setError("본부 서버에 닿지 않아요. 인터넷을 확인하고 다시 눌러 주세요.");
      setStage("intro");
    }
  };

  return (
    <main className="relative flex flex-1 flex-col justify-center gap-8">
      <div aria-hidden className="noise pointer-events-none fixed inset-0 opacity-40" />
      <div aria-hidden className="scanlines pointer-events-none fixed inset-0" />

      {stage === "reveal" ? (
        <Reveal onDone={() => router.push("/dashboard")} />
      ) : stage === "restore" ? (
        <RestoreForm onCancel={() => setStage("intro")} />
      ) : (
        <>
          <header className="relative text-center">
            <p className="font-mono text-[11px] tracking-[0.3em] text-fog">OPERATION · GRAY FOG</p>
            <h1 className="mt-3 text-5xl font-bold tracking-tight">
              <span className="glitch" data-text="평범한 스파이">
                평범한 스파이
              </span>
            </h1>
            <p className="mt-3 text-sm text-fog">회색 안개 통제 구역 · 수장 늘곰의 비밀 지령</p>
          </header>

          {stage === "boot" || stage === "welcomeBack" ? (
            <p className="relative text-center font-mono text-sm text-fog">
              {stage === "welcomeBack" ? "신분 확인 완료 · 본부 접속 중…" : "신분 확인 중…"}
            </p>
          ) : (
            <>
              <ol className="relative flex flex-col gap-1.5 rounded-md border border-line bg-panel/80 px-4 py-3 font-mono text-[12px] leading-relaxed text-zinc-300">
                {LINES.map((line, i) => (
                  <motion.li
                    key={line}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.45 }}
                  >
                    {line}
                  </motion.li>
                ))}
              </ol>

              <motion.div
                className="relative flex flex-col gap-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 + LINES.length * 0.45 }}
              >
                <button
                  type="button"
                  data-fx="custom"
                  onClick={enter}
                  disabled={stage === "issuing"}
                  className="rounded-lg border-2 border-magenta py-4 text-lg font-bold text-magenta shadow-[0_0_20px_#ff00ff33] transition-transform active:scale-[0.98] disabled:opacity-60"
                >
                  {stage === "issuing" ? "요원 신분 발급 중…" : "요원 신분 받기"}
                </button>
                {error && <p className="text-center text-sm text-magenta">{error}</p>}
                <button type="button" onClick={() => setStage("restore")} className="py-2 text-sm text-zinc-300 underline underline-offset-4">
                  이미 요원이에요 · 복구 코드로 이어하기
                </button>
                <p className="text-center text-[11px] text-fog">
                  이름·학번·전화번호는 묻지 않아요. 무작위 요원명과 미션 기록만 저장돼요.
                </p>
              </motion.div>
            </>
          )}
        </>
      )}
    </main>
  );
}

/** 처음 온 요원에게 요원명과 복구 코드를 보여 준다 */
function Reveal({ onDone }: { onDone: () => void }) {
  const { spy, status } = useSpy();
  const ready = status === "ready" && !!spy.codename;
  // 신분증이 펼쳐지는 순간 도장 쾅
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      feel("stamp", "heavy");
      burst(window.innerWidth / 2, window.innerHeight * 0.42, "pixels", { count: 36, power: 0.9 });
    }, 320);
    return () => clearTimeout(t);
  }, [ready]);
  if (status !== "ready" || !spy.codename) {
    return <p className="relative m-auto font-mono text-sm text-fog">요원명 배정 중…</p>;
  }
  return (
    <section className="relative flex flex-col gap-5">
      <div className="text-center">
        <p className="font-mono text-xs tracking-widest text-magenta">NEW AGENT REGISTERED</p>
        <h1 className="mt-2 text-xl font-bold">너의 요원명이 배정됐다</h1>
        <p className="mt-1 text-sm text-fog">본부는 너를 이 이름으로만 부른다.</p>
      </div>
      <IdCard codename={spy.codename} recoveryCode={spy.recoveryCode} />
      <button
        type="button"
        onClick={onDone}
        className="rounded-lg bg-magenta py-4 text-lg font-bold text-ink transition-transform active:scale-[0.98]"
      >
        복구 코드를 저장했어요 · 본부로
      </button>
    </section>
  );
}

function RestoreForm({ onCancel }: { onCancel: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const local = !isFirebaseConfigured;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await getSpyStore().restore(code);
      feel("latch", "unlock");
      await new Promise((r) => setTimeout(r, 450));
      // 구독을 새 요원 기준으로 다시 걸기 위해 페이지를 새로 연다 (router.push 로는 기존 구독이 남는다)
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/dashboard/`);
    } catch (err) {
      setError(err instanceof RestoreError ? RESTORE_MESSAGES[err.reason] : RESTORE_MESSAGES.network);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="relative flex flex-col gap-4">
      <div>
        <p className="font-mono text-xs tracking-widest text-magenta">AGENT RECOVERY</p>
        <h1 className="mt-2 text-xl font-bold">복구 코드로 이어하기</h1>
        <p className="mt-1 text-sm text-zinc-300">신분증에 있던 8글자 코드를 입력하면 그 요원으로 돌아가요. 이 폰에서 깬 미션도 합쳐져요.</p>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-fog">복구 코드</span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="K7Q4-MZ2P"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={12}
          className="rounded-lg border border-line bg-panel px-4 py-3 font-mono text-2xl tracking-[0.15em] uppercase outline-none focus:border-magenta"
        />
      </label>
      {error && <p className="text-sm text-magenta">{error}</p>}
      {local && <p className="text-xs text-fog">연습 모드에서는 이 브라우저에서 만든 코드만 불러올 수 있어요.</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 rounded-lg border border-line py-3">
          돌아가기
        </button>
        <button type="submit" disabled={busy || code.trim().length < 8} className="flex-1 rounded-lg bg-magenta py-3 font-bold text-ink disabled:opacity-40">
          {busy ? "확인 중…" : "이어하기"}
        </button>
      </div>
    </form>
  );
}
