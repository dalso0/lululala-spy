"use client";

import Link from "next/link";
import { IdCard } from "@/components/IdCard";
import { useSpy } from "@/hooks/useSpy";

/** 내 요원 신분증: 요원명 + 복구 코드 다시 보기 */
export default function IdPage() {
  const { status, spy } = useSpy();

  return (
    <main className="flex flex-1 flex-col gap-5">
      <nav className="flex items-center justify-between font-mono text-[11px] tracking-widest text-fog">
        <Link href="/dashboard" className="-ml-2 px-2 py-2">
          ‹ 상황판
        </Link>
        <span>AGENT ID</span>
      </nav>

      {status !== "ready" ? (
        <p className="m-auto font-mono text-sm text-fog">신분증 불러오는 중…</p>
      ) : (
        <>
          <IdCard codename={spy.codename} recoveryCode={spy.recoveryCode} />
          <section className="rounded-lg border border-line px-4 py-3 text-sm leading-relaxed text-zinc-300">
            <h2 className="mb-1 font-bold text-white">다른 폰에서 이어하려면</h2>
            새 폰에서 키링을 대거나 주소로 들어간 뒤, 첫 화면의 <b>「복구 코드로 이어하기」</b>를 누르고 위 코드를
            입력하세요. 이 폰에서 깬 미션도 그대로 이어져요.
          </section>
          <p className="text-center text-xs text-fog">본부는 이름·학번·전화번호를 저장하지 않아요.</p>
        </>
      )}
    </main>
  );
}
