"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useApprovedPosts } from "@/hooks/useLive";
import type { Post, PostKind } from "@/lib/store";

/** 상황판용: 선생님이 공개한 글을 한 줄씩 돌려 보여 준다. 글이 없으면 아무것도 안 그린다. */
export function CommsTicker({ kind }: { kind: PostKind }) {
  const posts = useApprovedPosts(kind);
  const [i, setI] = useState(0);
  const count = posts?.length ?? 0;

  useEffect(() => {
    if (count < 2) return;
    const t = setInterval(() => setI((n) => n + 1), 4500);
    return () => clearInterval(t);
  }, [count]);

  if (!posts || count === 0) return null;
  const post = posts[i % count];

  return (
    <section aria-label="본부 통신망" className="overflow-hidden rounded-md border border-line bg-panel px-3 py-2">
      <p className="font-mono text-[10px] tracking-widest text-fog">본부 통신망 · 요원들이 새긴 암호</p>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={post.id}
          className="mt-1 text-sm"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
        >
          “{post.text}”<span className="ml-2 text-xs text-fog">— {post.codename}</span>
        </motion.p>
      </AnimatePresence>
    </section>
  );
}

/** 미션 끝 화면용: 공개된 글 목록 */
export function CommsList({ kind, exceptAuthor, max = 6 }: { kind: PostKind; exceptAuthor?: string | null; max?: number }) {
  const posts = useApprovedPosts(kind);
  if (!posts) return null;
  const shown: Post[] = posts.filter((p) => p.authorId !== exceptAuthor).slice(0, max);

  return (
    <section aria-label="다른 요원들의 글" className="flex flex-col gap-2">
      <h2 className="font-mono text-[11px] tracking-widest text-fog">다른 요원들이 새긴 암호</h2>
      {shown.length === 0 ? (
        <p className="rounded-md border border-dashed border-line px-3 py-3 text-sm text-fog">
          아직 공개된 암호가 없어요. 선생님 확인을 거치면 여기에 하나씩 나타나요.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((p, k) => (
            <motion.li
              key={p.id}
              className="rounded-md border border-line bg-panel px-3 py-2 text-sm"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: k * 0.08 }}
            >
              “{p.text}”<span className="mt-0.5 block text-xs text-fog">— {p.codename}</span>
            </motion.li>
          ))}
        </ul>
      )}
    </section>
  );
}
