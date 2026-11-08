"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { asset } from "@/lib/asset";
import { formatRecoveryCode } from "@/lib/codename";

/** 요원 신분증: 무작위 요원명 + 복구 코드. 이름·학번은 어디에도 없다. */
export function IdCard({ codename, recoveryCode }: { codename: string; recoveryCode: string | null }) {
  const [copied, setCopied] = useState(false);
  const [name, tag] = codename.split(" #");

  const copy = async () => {
    if (!recoveryCode) return;
    try {
      await navigator.clipboard.writeText(formatRecoveryCode(recoveryCode));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* 복사가 막힌 브라우저: 화면을 보고 적으면 된다 */
    }
  };

  return (
    <motion.article
      className="relative overflow-hidden rounded-xl border-2 border-magenta bg-panel p-5"
      initial={{ rotateX: 70, opacity: 0 }}
      animate={{ rotateX: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 140, damping: 16 }}
      style={{ transformPerspective: 800 }}
    >
      <div className="noise absolute inset-0 opacity-20" aria-hidden />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] tracking-[0.25em] text-magenta">AGENT ID · 평범한 스파이</p>
          <h2 className="mt-2 text-2xl font-bold leading-tight">{name}</h2>
          {tag && <p className="font-mono text-sm text-fog">#{tag}</p>}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset("/art/stand.webp")} alt="" className="h-20 shrink-0 opacity-90 grayscale" />
      </div>

      <div className="relative mt-5 rounded-lg border border-dashed border-line bg-ink/60 p-3">
        <p className="font-mono text-[10px] tracking-widest text-fog">복구 코드 · 비밀</p>
        {recoveryCode ? (
          <div className="mt-1 flex items-center justify-between gap-3">
            <p className="font-mono text-2xl font-bold tracking-[0.15em]">{formatRecoveryCode(recoveryCode)}</p>
            <button type="button" onClick={copy} className="shrink-0 rounded-md border border-line px-3 py-1.5 text-xs">
              {copied ? "복사됨" : "복사"}
            </button>
          </div>
        ) : (
          <p className="mt-1 text-sm text-fog">아직 발급되지 않았어요. 본부 서버와 연결되면 생겨요.</p>
        )}
        <p className="mt-2 text-xs leading-relaxed text-zinc-400">
          폰을 바꾸거나 기록이 사라져도 이 코드만 있으면 같은 요원으로 돌아올 수 있어요. 캡처하거나 수첩에 적어 두고,
          친구에게는 보여 주지 마세요.
        </p>
      </div>
    </motion.article>
  );
}
