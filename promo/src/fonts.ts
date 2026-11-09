// 글꼴 (모두 공개 글꼴: Pretendard · 나눔고딕코딩 · 개구) — 다 불러온 뒤에 그리기 시작한다
import { continueRender, delayRender, staticFile } from "remotion";

const FACES: [string, string, string][] = [
  ["Pretendard", "fonts/Pretendard-Black.woff2", "900"],
  ["Pretendard", "fonts/Pretendard-ExtraBold.woff2", "800"],
  ["Pretendard", "fonts/Pretendard-Bold.woff2", "700"],
  ["NanumGothicCoding", "fonts/NanumGothicCoding-Bold.ttf", "700"],
  ["Gaegu", "fonts/Gaegu-Bold.ttf", "700"],
];

if (typeof document !== "undefined") {
  const handle = delayRender("글꼴 불러오기");
  Promise.all(
    FACES.map(([family, file, weight]) =>
      new FontFace(family, `url(${staticFile(file)})`, { weight }).load().then((f) => {
        (document.fonts as unknown as { add: (face: FontFace) => void }).add(f);
      }),
    ),
  )
    .catch((e) => console.error(e))
    .finally(() => continueRender(handle));
}
