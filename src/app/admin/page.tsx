"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useGame } from "@/hooks/useLive";
import { isFirebaseConfigured } from "@/lib/firebase";
import { getSpyStore, POST_KINDS, type Post, type PostStatus, type TeacherSession } from "@/lib/store";

/** 선생님 관제실: 학생 글 검토 · 게시, 늘곰 연구소(엔딩) 개방 */
export default function AdminPage() {
  const [session, setSession] = useState<TeacherSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getSpyStore()
      .teacher.session()
      .then((s) => alive && setSession(s))
      .catch(() => alive && setSession({ state: "signedOut" }));
    return () => {
      alive = false;
    };
  }, []);

  const signIn = async () => {
    setError(null);
    try {
      setSession(await getSpyStore().teacher.signIn());
    } catch (e) {
      const code = (e as { code?: string }).code ?? "";
      setError(
        code === "auth/popup-blocked"
          ? "팝업이 막혔어요. 브라우저 주소창 옆에서 팝업을 허용해 주세요."
          : code === "auth/unauthorized-domain"
            ? "이 주소가 Firebase 로그인 허용 도메인에 없어요. 콘솔 → Authentication → 설정 → 승인된 도메인에 추가해 주세요."
            : "로그인하지 못했어요. 다시 시도해 주세요.",
      );
    }
  };

  const signOut = async () => {
    await getSpyStore().teacher.signOut();
    setSession({ state: "signedOut" });
  };

  return (
    <main className="flex flex-1 flex-col gap-5">
      <header className="flex items-baseline justify-between">
        <div>
          <p className="font-mono text-[11px] tracking-widest text-fog">HQ CONTROL ROOM</p>
          <h1 className="text-xl font-bold">본부 관제실 · 선생님용</h1>
        </div>
        {session?.state === "teacher" && isFirebaseConfigured && (
          <button type="button" onClick={signOut} className="text-xs text-fog underline">
            로그아웃
          </button>
        )}
      </header>

      {!isFirebaseConfigured && (
        <p className="rounded-md border border-dashed border-line px-3 py-2 text-xs leading-relaxed text-fog">
          연습 모드예요. 이 브라우저 안에서 쓴 글만 보이고, 누구나 이 화면을 열 수 있어요. Firebase를 연결하면 선생님 구글
          계정으로만 열려요.
        </p>
      )}

      {!session ? (
        <p className="m-auto font-mono text-sm text-fog">확인 중…</p>
      ) : session.state === "signedOut" ? (
        <section className="flex flex-col gap-3 rounded-lg border border-line p-4">
          <p className="text-sm text-zinc-300">학생 글을 검토하려면 선생님 구글 계정으로 로그인하세요.</p>
          <button type="button" onClick={signIn} className="rounded-lg bg-white py-3 font-bold text-ink">
            구글 계정으로 로그인
          </button>
          {error && <p className="text-sm text-magenta">{error}</p>}
        </section>
      ) : session.state === "notTeacher" ? (
        <section className="flex flex-col gap-3 rounded-lg border border-magenta/60 p-4 text-sm">
          <p>
            지금 로그인한 계정 <b>{session.email ?? "(이메일 없음)"}</b> 은 선생님 목록에 없어요.
          </p>
          <p className="text-zinc-300">
            <code className="font-mono">firestore.rules</code> 의 선생님 목록(<code className="font-mono">isTeacher</code>)에 이
            이메일을 넣고 Firebase 콘솔에서 규칙을 다시 게시해 주세요.
          </p>
          <button type="button" onClick={signOut} className="rounded-lg border border-line py-3">
            다른 계정으로 로그인
          </button>
        </section>
      ) : (
        <Console />
      )}

      <Link href="/dashboard" className="mt-auto pt-6 text-center text-xs text-fog underline">
        학생 화면 보기
      </Link>
    </main>
  );
}

const TABS: { status: PostStatus; label: string }[] = [
  { status: "pending", label: "검토 대기" },
  { status: "approved", label: "공개 중" },
  { status: "rejected", label: "숨김" },
];

function Console() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [tab, setTab] = useState<PostStatus>("pending");
  const game = useGame();

  useEffect(() => {
    return getSpyStore().teacher.subscribeAll(setPosts, (e) => console.error("[admin] 글 불러오기 실패", e));
  }, []);

  const counts = useMemo(() => {
    const c: Record<PostStatus, number> = { pending: 0, approved: 0, rejected: 0 };
    posts?.forEach((p) => c[p.status]++);
    return c;
  }, [posts]);

  // 위기 표현이 있는 글을 맨 위로
  const shown = (posts ?? [])
    .filter((p) => p.status === tab)
    .sort((a, b) => Number(b.flagged) - Number(a.flagged) || b.createdAt - a.createdAt);

  const toggleEnding = async () => {
    if (!game) return;
    const next = !game.endingOpen;
    const ok = window.confirm(
      next
        ? "늘곰 연구소를 열까요?\n모든 학생 화면에 엔딩이 열리고, 회색 안개가 완전히 걷혀요. (D-Day 정리 시간에 여세요)"
        : "늘곰 연구소를 다시 닫을까요?",
    );
    if (ok) await getSpyStore().teacher.setEndingOpen(next);
  };

  return (
    <>
      <section className="rounded-lg border border-line bg-panel p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold">늘곰 연구소 (엔딩)</h2>
            <p className="mt-0.5 text-xs text-fog">열면 모든 학생에게 엔딩과 탈출 인증서가 열려요.</p>
          </div>
          <span
            className={`shrink-0 rounded px-2 py-1 font-mono text-xs ${game?.endingOpen ? "bg-magenta text-ink" : "border border-line text-fog"}`}
          >
            {game ? (game.endingOpen ? "열림" : "닫힘") : "…"}
          </span>
        </div>
        <button
          type="button"
          onClick={toggleEnding}
          disabled={!game}
          className={`mt-3 w-full rounded-lg py-3 font-bold disabled:opacity-40 ${game?.endingOpen ? "border border-line" : "bg-magenta text-ink"}`}
        >
          {game?.endingOpen ? "연구소 다시 닫기" : "연구소 열기"}
        </button>
      </section>

      <section className="flex flex-col gap-3">
        <div role="tablist" className="grid grid-cols-3 gap-1 rounded-lg border border-line p-1">
          {TABS.map((t) => (
            <button
              key={t.status}
              role="tab"
              type="button"
              aria-selected={tab === t.status}
              onClick={() => setTab(t.status)}
              className={`rounded-md py-2 text-sm ${tab === t.status ? "bg-white font-bold text-ink" : "text-zinc-300"}`}
            >
              {t.label} {posts ? counts[t.status] : ""}
            </button>
          ))}
        </div>

        {!posts ? (
          <p className="py-6 text-center font-mono text-sm text-fog">불러오는 중…</p>
        ) : shown.length === 0 ? (
          <p className="rounded-md border border-dashed border-line py-6 text-center text-sm text-fog">
            {tab === "pending" ? "검토할 글이 없어요." : "글이 없어요."}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {shown.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

const timeFmt = new Intl.DateTimeFormat("ko-KR", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Seoul",
});

function PostCard({ post }: { post: Post }) {
  const [busy, setBusy] = useState(false);
  const review = async (status: PostStatus) => {
    setBusy(true);
    try {
      await getSpyStore().teacher.review(post.id, status);
    } catch (e) {
      console.error(e);
      window.alert("저장하지 못했어요. 인터넷 연결을 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={`rounded-lg border p-3 ${post.flagged ? "border-magenta" : "border-line"}`}>
      {post.flagged && (
        <p className="mb-2 rounded bg-magenta/15 px-2 py-1.5 text-xs leading-relaxed text-magenta">
          ⚠ 위기 표현이 들어 있어요. 학생 화면에는 상담 연락처가 바로 떴어요. 요원명만으로는 누구인지 알 수 없으니, 반 전체에
          도움 창구를 한 번 더 안내해 주세요.
        </p>
      )}
      <p className="font-mono text-[11px] text-fog">
        {POST_KINDS[post.kind]} · {timeFmt.format(post.createdAt)}
      </p>
      <p className="mt-1 text-base leading-relaxed">“{post.text}”</p>
      <p className="mt-1 text-xs text-fog">— {post.codename}</p>
      <div className="mt-3 flex gap-2">
        {post.status !== "approved" && (
          <button type="button" disabled={busy} onClick={() => review("approved")} className="flex-1 rounded-md bg-magenta py-2 text-sm font-bold text-ink disabled:opacity-40">
            공개하기
          </button>
        )}
        {post.status !== "rejected" && (
          <button type="button" disabled={busy} onClick={() => review("rejected")} className="flex-1 rounded-md border border-line py-2 text-sm disabled:opacity-40">
            숨기기
          </button>
        )}
      </div>
    </li>
  );
}
