# 평범한 스파이 홍보 쇼츠 (30초 세로 영상)

학생 참여 독려 · 키링 태그 유도. 1080×1920 · 30fps · 30초.
[Remotion](https://www.remotion.dev/)(React 로 영상을 만드는 도구)으로 만들고, 앱 화면은 실제 앱을 프레임 단위로 녹화해서 쓴다.
앱 빌드와 상관없다(앱의 tsconfig·eslint 에서 빠져 있음).

## 이야기 (src/timeline.json)

| 초 | 장면 |
|---|---|
| 0–2.8 | 합천중학교에 회색 안개가 퍼졌다 (회색 본부 · 지지직) |
| 2.8–6 | 늘곰 SOS "…여기는 늘곰. 들리나…" → 연락이 끊겼다 |
| 6–9.6 | 본부가 새 요원을 찾는다 → 실제 앱의 요원명 발급 → **바로 너.** |
| 9.6–21.6 | 작전 3초씩: 평범지령 · 시한폭탄 · 진실의 거울 · 픽셀 장착 (픽셀 5칸이 하나씩) |
| 21.6–25.6 | 본부에 색이 돌아온다 → **12.15 D-DAY** 탈출 문 |
| 25.6–30 | **키링을 폰에 톡!** → 앱이 열리고 → 늘곰 구출 작전 지금 개시! |

## 다시 만들기

1. (spy 폴더) `NEXT_PUBLIC_BASE_PATH=/lululala-spy npm run build` → `out/` 을 `http://localhost:3200/lululala-spy/` 로 띄운다
2. (promo 폴더) `npm install`
3. `node scripts/prepare.cjs` — 본부 파노라마를 장면별로 자르고, 폭탄·장치 가방 그림과 늘곰 공식 포즈(`../../neulgom-media/poses-new`)를 모은다
4. `node scripts/capture.cjs` — 앱 화면 녹화. 브라우저 시계를 멈추고 1/30초씩 넘기며 찍어서 끊김이 없다
5. 글꼴을 `public/fonts/` 에 받아 둔다 (모두 공개 글꼴 OFL):
   Pretendard-Black/ExtraBold/Bold.woff2 (cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/static/woff2/),
   NanumGothicCoding-Bold.ttf · Gaegu-Bold.ttf (github.com/google/fonts 의 ofl/)
6. `node scripts/sfx.cjs` — 앱 효과음(src/lib/fx/sound.ts 그대로)과 배경 음악(직접 합성, 저작권 걱정 없음)을 만들고
   한 줄로 섞어(`public/sfx/mix.wav`) 쇼츠 크기(평균 약 -16dB, 최고 -1dB)로 맞춘다
7. `npx remotion render src/index.ts Promo out/promo.mp4` (몇 장만 확인: `node scripts/stills.cjs 40 250 880`)

## 고칠 곳

- 장면 시간: `src/timeline.json` → 바꾸면 6번(sfx)부터 다시. 음악과 효과음 자리가 따라온다
- 자막 · 장면: `src/scenes.tsx` / 공통 조각(폰 · 자막 · 픽셀 칸 · 키링): `src/ui.tsx`
- 효과음 자리: `scripts/sfx-plan.cjs`
- 키링 그림은 임시 그림이다. 실제 키링 사진을 받으면 `Keyring` 을 사진으로 바꾼다
