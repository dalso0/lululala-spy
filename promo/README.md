# 평범한 스파이 홍보 쇼츠 (32초 세로 영상 · 합본)

학생 참여 독려 · 키링 태그 유도. 1080×1920 · 30fps · 32초.
[Remotion](https://www.remotion.dev/)(React 로 영상을 만드는 도구)으로 만든다.
시네마틱 장면은 다른 모델이 만든 `video7.mp4`(720×1280, 10초, 소리 포함)를 그대로 쓰고,
앱 장면은 실제 앱을 프레임 단위로 녹화해서 쓴다. 앱 빌드와 상관없다(앱의 tsconfig·eslint 에서 빠져 있음).

## 이야기 (src/timeline.json)

| 초 | 장면 | 출처 |
|---|---|---|
| 0–6 | 경고: 회색 안개 감지 → 수장 늘곰 "당신의 평범함을 무기로 쓸 때다."(목소리) → [작전명: 평범한 스파이] | video7 0–6초 |
| 6–9 | 본부가 새 요원을 찾는다 → 실제 앱의 요원명 발급 → **바로 너.** | 앱 녹화 |
| 9–10.6 | 4-4-6 호흡 타이머 · 일상의 감각을 해킹하라! | video7 6–7.6초 |
| 10.6–20.6 | 작전 2.5초씩: 평범지령 · 시한폭탄 · 진실의 거울 · 픽셀 장착 (픽셀 5칸이 하나씩) | 앱 녹화 |
| 20.6–24.6 | 본부에 색이 돌아온다 → **12.15 D-DAY** 탈출 문 | 앱 본부 그림 |
| 24.6–27.6 | **키링을 폰에 톡!** → 태그하면 본부가 열린다 (키링은 video7 과 같은 빛나는 원판) | 앱 녹화 |
| 27.6–29.5 | 11.16(월) 요원 소집 · 지금 바로 키링을 태그하라 | video7 8–9.9초 |
| 29.5–32 | 평범한 스파이 · 늘곰 "기다릴게!" · 11.16(월) 요원 소집 · **작전 개시!** | 늘곰 공식 포즈 |

소리: video7 장면은 그 영상의 소리(경보 · 늘곰 목소리 · 효과)를 그대로, 앱 장면은 앱 효과음 + 직접 합성한 음악(144 BPM).
모두 한 줄로 미리 섞어 쇼츠 크기(평균 약 -16dB, 최고 -1dB)로 맞춘다.

## 다시 만들기

1. (spy 폴더) `NEXT_PUBLIC_BASE_PATH=/lululala-spy npm run build` → `out/` 을 `http://localhost:3200/lululala-spy/` 로 띄운다
2. (promo 폴더) `npm install`
3. `node scripts/prepare.cjs` — 본부 파노라마를 장면별로 자르고, 폭탄·장치 가방 그림, 늘곰 공식 포즈(`../../neulgom-media/poses-new`),
   video7(`../video7.mp4` → `public/footage/v7.mp4`)을 모은다
4. `node scripts/capture.cjs` — 앱 화면 녹화. 브라우저 시계를 멈추고 1/30초씩 넘기며 찍어서 끊김이 없다
5. 글꼴을 `public/fonts/` 에 받아 둔다 (모두 공개 글꼴 OFL):
   Pretendard-Black/ExtraBold/Bold.woff2 (cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/static/woff2/),
   NanumGothicCoding-Bold.ttf · Gaegu-Bold.ttf (github.com/google/fonts 의 ofl/)
6. `node scripts/sfx.cjs` — 앱 효과음(src/lib/fx/sound.ts 그대로)과 배경 음악(직접 합성, 저작권 걱정 없음)을 만들고
   video7 소리 조각과 함께 한 줄로 섞어(`public/sfx/mix.wav`) 쇼츠 크기(평균 약 -16dB, 최고 -1dB)로 맞춘다
7. `npx remotion render src/index.ts Promo out/promo.mp4` (몇 장만 확인: `node scripts/stills.cjs 40 250 880`)

## 고칠 곳

- 장면 시간 · video7 에서 가져올 구간: `src/timeline.json` → 바꾸면 6번(sfx)부터 다시. 음악·효과음·video7 소리가 따라온다
- 자막 · 장면: `src/scenes.tsx` / 공통 조각(폰 · 자막 · 픽셀 칸 · 키링): `src/ui.tsx`
- 효과음 자리: `scripts/sfx-plan.cjs`
- 키링 그림은 임시 그림이다. 실제 키링 사진을 받으면 `Keyring` 을 사진으로 바꾼다
