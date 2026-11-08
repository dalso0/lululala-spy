import { HELP_LINES } from "@/lib/safety";

/** 마음이 많이 힘들 때 연락할 곳. 위기 표현이 담긴 글을 쓰면 바로 보여 준다. */
export function HelpCard({ title = "혼자 버티지 않아도 돼요" }: { title?: string }) {
  return (
    <section className="rounded-lg border border-line bg-panel p-4 text-left" aria-label="도움받을 수 있는 곳">
      <h2 className="font-bold">{title}</h2>
      <p className="mt-1 text-sm text-zinc-300">
        지금 마음이 많이 무겁다면, 아래 어른들이 언제든 이야기를 들어 줘요.
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {HELP_LINES.map((h) => (
          <li key={h.name} className="flex items-center justify-between gap-3 text-sm">
            <span>
              <b>{h.name}</b>
              <span className="ml-1 text-xs text-fog">{h.note}</span>
            </span>
            {h.tel ? (
              <a href={`tel:${h.tel}`} className="shrink-0 rounded-md border border-line px-3 py-1.5 font-mono">
                {h.tel}
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
