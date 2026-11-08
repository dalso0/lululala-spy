# 평범한 스파이 — 회색 안개 통제 구역

중학생 대상 오감 힐링 방탈출 웹앱. Next.js(App Router) 정적 내보내기 + Firebase(익명 로그인 · Firestore).

## 실행

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # out/ 폴더에 정적 사이트 생성 (GitHub Pages 등에 그대로 올림)
```

Firebase 설정이 없으면 **연습 모드**로 돈다: 모든 기록이 그 브라우저(localStorage)에만 저장되고,
관제실(`/admin`)도 로그인 없이 열린다. 흐름(요원명 · 복구 코드 · 글 검토 · 연구소 개방)은 서버 모드와 같다.

## 배포 · 버전

- 저장소: https://github.com/dalso0/lululala-spy (공개) · 주소: https://dalso0.github.io/lululala-spy/
- `main` 에 올리면 GitHub Actions(`.github/workflows/deploy.yml`)가 빌드해 GitHub Pages 로 자동 배포한다.
- 버전은 `v0.x.y` 태그 + GitHub 릴리스로 기록한다. 학생용 NFC 주소(dalso0.github.io/lululala/)와는 별개다.

## 원칙

- **개인정보 없음**: 이름·학번·전화번호·이메일을 받지 않는다. 학생은 익명 로그인 + 무작위 요원명(예: `수상한 수달 #4CC4`).
- **글쓰기 허용, 공개는 선생님 검토 후**: 학생 글은 모두 `검토 대기`로 올라가고(체크 칸 없음), 선생님이 관제실에서 `공개`해야 다른 요원에게 요원명으로 보인다. 학생 화면에는 "선생님 확인 후 요원명으로 공개될 수 있다"는 안내만 보인다.
- **위기 표현 안전망**: 글에 위기 표현이 있으면 학생 화면에 상담 연락처(109 · 1388 · Wee클래스)를 바로 띄우고, 관제실에 ⚠ 표시를 붙인다.
- **구역 목표**: 제1구역 평범지령 1개 · 제2구역 함정 2개 · 제3구역 부스 2곳 = 픽셀 5칸. 부스는 학생마다 6곳 중 2~3곳만 돌 수 있으므로 2곳이면 충분하고, 그 이상은 보너스 조각.
- **엔딩은 선생님이 연다**: 관제실의 `연구소 열기`를 누르면 모든 학생 화면에 동시에 열린다(조각 수와 무관).

## 2.5D 본부 · 손맛

풀 3D(Three.js) 없이 렌더 그림 몇 장 위에 레이어를 겹쳐 입체감과 손맛을 낸다. 그림은 `public/art/` 의 WebP(장당 약 100KB).

- **본부(`hq.webp`)**: 처음엔 전원이 꺼진 흑백. 첫 터치로 전원이 들어오고, 미션을 깰 때마다 그 물건 자리만 원래 색으로 불이 켜진다
  (코르크보드=평범지령, 심박 모니터=시한폭탄, 스탠드=거울 방, 창문·라디오·머그·봉인 장치=부스, 늘곰 간판=엔딩).
  손가락을 옆으로 끌거나 폰을 기울이면 무대가 살짝 기울고(안드로이드), 물건을 누르면 다가가 들여다본다. 좌표는 `lib/hq.ts`.
- **픽셀 장착 의식(`case.webp`)**: 새로 깬 미션이 있으면 상황판에 들어올 때 장치 가방이 올라온다. 픽셀 코어를 누르면 자물쇠(5개 = 픽셀 목표 5칸)에 꽂히고,
  톱니가 철컥철컥 돌고, 하트 센서가 충전되며 파티클이 터진다. 그림 속 톱니는 같은 그림을 동그랗게 오려 돌리는 방식(`components/fx/ImageCutout.tsx`).
- **시한폭탄(`bomb.webp`)**: 게이지 유리판 위에 살아 있는 호흡 바늘·고리, 오른쪽 연결 막대 3개가 호흡 한 번마다 하나씩 끊어진다.
- **소리**: 파일 없이 Web Audio 로 합성한 아날로그 효과음(딸깍·철컥·톱니·지직·종소리·유리…, `lib/fx/sound.ts`). 상황판 오른쪽 위 스피커 버튼으로 끈다.
  아이폰은 무음 스위치를 켜면 소리가 나지 않는다.
- **진동**: 안드로이드는 패턴 진동, 아이폰은 공식 진동 기능이 없어 iOS 18+ 에서만 짧은 '톡' 한 번(`lib/fx/haptics.ts`).
- **파티클**: 화면 전체 캔버스 하나에 그린다(`lib/fx/particles.ts`). '동작 줄이기'를 켠 기기에서는 큰 움직임과 파티클을 뺀다.
- **가볍게**: Firebase 코드는 처음 쓰는 순간 따로 불러온다(연습 모드에선 안 받음). 상황판 첫 화면 JS 약 250KB(gzip) + 그림 약 200KB.

그림을 바꿀 때: 원본을 같은 비율로 만들어 `public/art/` 의 같은 이름으로 넣고, 물건 위치가 달라졌으면 `lib/hq.ts`(본부)·
`components/hq/PixelCeremony.tsx`(자물쇠·톱니)·`components/missions/BreathingBomb.tsx`(게이지·막대) 맨 위 좌표를 고친다.

## 요원 신분 · 복구 코드

1. 첫 접속 → 익명 로그인 → 요원명 배정 → 8글자 **복구 코드** 발급(예: `K7Q4-MZ2P`).
2. 복구 코드는 Firebase 계정에 `코드@agent.invalid` / 비밀번호 `코드` 로 연결된다(실제 메일 주소 아님).
3. 폰을 바꾸거나 사파리가 기록을 지웠을 때: 첫 화면 → `복구 코드로 이어하기` → 같은 요원으로 돌아오고, 새 폰에서 깬 미션도 합쳐진다.
4. 신분증(`/id`)에서 요원명과 복구 코드를 언제든 다시 볼 수 있다.

## Firebase 연결할 때 콘솔에서 할 일

1. 프로젝트 만들기 → 웹 앱 추가 → 설정값을 `.env.local.example` 을 복사한 `.env.local` 에 채우기
2. **Authentication → 로그인 방법**: `익명`, `이메일/비밀번호`, `Google` 세 가지 켜기
3. **Authentication → 설정 → 승인된 도메인**: 배포 주소(예: `dalso0.github.io`) 추가
4. **Firestore Database** 만들기(서울 `asia-northeast3`) → 규칙 탭에 `firestore.rules` 붙여 넣고 게시
5. 붙여 넣은 규칙의 `isTeacher()` 안 `teacher@example.com` 을 선생님 구글 계정으로 바꾼 뒤 게시 (저장소에는 예시 주소만 둔다)
6. GitHub 저장소 Settings → Secrets and variables → Actions → Variables 에 `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`,
   `FIREBASE_PROJECT_ID`, `FIREBASE_APP_ID` 를 넣으면 다음 배포부터 본부 서버에 저장된다 (비워 두면 연습 모드)

## 폴더 구조

```
src/
├─ app/
│  ├─ page.tsx                   /            접속 · 요원 신분 받기 · 복구 코드로 이어하기
│  ├─ dashboard/page.tsx         /dashboard   상황판
│  ├─ id/page.tsx                /id          내 신분증 (요원명 · 복구 코드)
│  ├─ mission/[id]/page.tsx      /mission/:id 미션 (목록에 있는 ID만 정적 생성)
│  ├─ ending/page.tsx            /ending      늘곰 연구소 (선생님이 열면)
│  └─ admin/page.tsx             /admin       선생님 관제실: 글 검토 · 연구소 개방
├─ components/
│  ├─ Dashboard.tsx              픽셀 미터 · 2.5D 본부 · 픽셀 장착 의식 · 통신망 · 엔딩 팝업
│  ├─ hq/HQScene.tsx             2.5D 본부: 불빛 레이어 · 기울기 · 들여다보기
│  ├─ hq/PixelCeremony.tsx       픽셀 장착 의식 (장치 가방 · 자물쇠 · 톱니 · 하트 센서)
│  ├─ fx/FxRoot.tsx              첫 터치 오디오 깨우기 · 모든 버튼 딸깍 · 파티클 캔버스
│  ├─ fx/SoundToggle.tsx         효과음 켜기/끄기
│  ├─ fx/ImageCutout.tsx         그림 속 톱니를 오려 돌리는 2.5D 트릭
│  ├─ MissionList.tsx            구역별 목표 · 미션 카드
│  ├─ IdCard.tsx                 요원 신분증
│  ├─ CommsFeed.tsx              선생님이 공개한 글 (상황판 한 줄 / 미션 끝 목록)
│  ├─ HelpCard.tsx               상담 연락처
│  └─ missions/
│     ├─ MissionRouter.tsx       미션 ID → 화면, 잠금 검사
│     ├─ DailyOrders.tsx         제1구역: 평범지령 체크 → 첫 픽셀 · 방화벽 게이지 · 늘곰 SOS 해독
│     ├─ BreathingBomb.tsx       미션 1: 스트레스 시한폭탄
│     └─ MirrorRoom.tsx          미션 2: 진실의 거울 방 (끌어서 버리기 → 암호 새기기 → 거울 깨기)
├─ hooks/
│  ├─ useBreathingCycle.ts       호흡 타이머 상태 관리
│  ├─ useSpy.ts                  요원 진행도 실시간 구독
│  └─ useLive.ts                 게임 설정 · 내 글 · 공개 글 구독
└─ lib/
   ├─ missions.ts                ★ 미션 목록 · 구역 목표 · 잠금 규칙 · D-Day 날짜
   ├─ daily.ts                   ★ 평범지령 목록 · 늘곰 SOS 문장
   ├─ hq.ts                      ★ 본부 그림 속 물건 좌표 · 어떤 미션에 어디가 켜지는지
   ├─ fx/                        소리(sound) · 진동(haptics) · 파티클(particles)
   ├─ codename.ts                요원명 · 복구 코드 만들기
   ├─ safety.ts                  위기 표현 확인 · 상담 연락처
   ├─ firebase.ts                Firebase 초기화
   └─ store/                     저장소 (server.ts = Firebase, local.ts = 연습 모드)
firestore.rules                  보안 규칙
```

## 데이터

| 위치 | 내용 |
|---|---|
| `spies/{uid}` | `codename`, `recoveryCode`(본인만 읽음), `clearedMissions`, `pixels`(= 깬 미션 수), `dailyDone`(해낸 평범지령), `finalRoutine`, `isLoggedIn` |
| `posts/{uid}_{종류}` | `authorId`, `codename`, `kind`(mirror·routine), `text`(≤100자), `status`(pending·approved·rejected), `flagged`, `createdAt`, `reviewedAt` |
| `config/game` | `endingOpen` — 선생님만 바꿈 |

## 새 미션 추가

1. `lib/missions.ts` 의 `MISSIONS` 에 항목 추가 (`ready: true`)
2. `components/missions/` 에 화면 컴포넌트 작성 → 끝나면 `useSpy().clearMission(id)` 호출
3. `MissionRouter.tsx` 의 `SCREENS` 에 한 줄 등록

## 그림

| 파일 | 원본 | 처리 |
|---|---|---|
| `public/art/hq.webp` | `image4.png` (896×1200) | 그대로 WebP |
| `public/art/case.webp` | `image.png` | 위 버튼·아래 "PIXELS ACQUIRED" 글씨를 잘라 냄 (896×680) |
| `public/art/bomb.webp` | `image2.png` | 위 제목·타이머, 아래 화살표를 잘라 냄 (896×865) |

`image3.png` 는 늘곰 자리에 사람 얼굴이 새겨져 있어 쓰지 않았다. 폴더 맨 위의 원본 PNG 들은 배포되지 않는다.
