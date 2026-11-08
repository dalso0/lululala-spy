import type { Sense } from "../missions";

/** Firestore `spies/{uid}` — 요원 한 명. 이름·학번·이메일은 없다. */
export type SpyDoc = {
  isLoggedIn: boolean;
  /** 무작위 요원명 (예: "수상한 수달 #4CC4"). 처음 정해지면 바뀌지 않는다 */
  codename: string;
  /** 다른 폰에서 이어하기용 복구 코드. 본인만 읽을 수 있다 */
  recoveryCode: string | null;
  /** 깬 미션 수 (= clearedMissions.length) */
  pixels: number;
  clearedMissions: string[];
  /** 해낸 평범지령 ID (제1구역) */
  dailyDone: string[];
  /** 엔딩에서 고른 감각 */
  finalRoutine: Sense | null;
};

/** 학생 글의 종류 */
export type PostKind = "mirror" | "routine";

export const POST_KINDS: Record<PostKind, string> = {
  mirror: "거울 방 · 나를 지키는 암호",
  routine: "늘곰 연구소 · 나만의 안정화 루틴",
};

/** pending: 선생님 검토 전 / approved: 다른 요원에게 공개 / rejected: 공개 안 함 */
export type PostStatus = "pending" | "approved" | "rejected";

/** Firestore `posts/{uid}_{kind}` — 한 요원이 종류마다 글 하나. 다시 쓰면 다시 검토. */
export type Post = {
  id: string;
  authorId: string;
  codename: string;
  kind: PostKind;
  text: string;
  status: PostStatus;
  /** 위기 표현이 들어 있어 선생님이 먼저 봐야 하는 글 */
  flagged: boolean;
  /** ms */
  createdAt: number;
  reviewedAt: number | null;
};

export const POST_MAX_LENGTH = 100;

/** Firestore `config/game` — 선생님이 관제실에서 바꾸는 값 */
export type GameConfig = {
  /** 늘곰 연구소(엔딩) 개방 */
  endingOpen: boolean;
};

export const DEFAULT_GAME: GameConfig = { endingOpen: false };

export type StartResult = { spyId: string; isNew: boolean };

export type TeacherSession =
  | { state: "signedOut" }
  | { state: "notTeacher"; email: string | null }
  | { state: "teacher"; email: string | null };

type Unsub = () => void;
type OnError = (e: unknown) => void;

export type SpyStore = {
  mode: "server" | "local";

  /* 학생 */
  /** 이미 요원 신분이 있는지 (자동 입장용) */
  hasSession(): Promise<boolean>;
  /** 요원 신분 확보: 처음이면 익명 로그인 + 요원명 + 복구 코드 발급 */
  start(): Promise<StartResult>;
  subscribeSpy(onData: (spy: SpyDoc) => void, onError: OnError): Unsub;
  /** 처음 깬 미션이면 true (픽셀 +1) */
  clearMission(missionId: string): Promise<boolean>;
  /** 평범지령 보고. 처음 보고하면 제1구역 미션 완료 → true (픽셀 +1) */
  recordDaily(orderIds: string[]): Promise<boolean>;
  setFinalRoutine(sense: Sense): Promise<void>;
  /** 복구 코드로 다른 폰의 요원 신분을 불러온다 (이 폰에서 깬 미션은 합쳐 준다) */
  restore(code: string): Promise<void>;

  /* 글 */
  submitPost(kind: PostKind, text: string, flagged: boolean): Promise<void>;
  subscribeMyPosts(onData: (posts: Post[]) => void, onError: OnError): Unsub;
  subscribeApproved(kind: PostKind, onData: (posts: Post[]) => void, onError: OnError): Unsub;

  /* 게임 설정 */
  subscribeGame(onData: (game: GameConfig) => void, onError: OnError): Unsub;

  /* 선생님 */
  teacher: {
    session(): Promise<TeacherSession>;
    signIn(): Promise<TeacherSession>;
    signOut(): Promise<void>;
    subscribeAll(onData: (posts: Post[]) => void, onError: OnError): Unsub;
    review(postId: string, status: PostStatus): Promise<void>;
    setEndingOpen(open: boolean): Promise<void>;
  };
};
