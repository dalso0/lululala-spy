export type RestoreErrorReason = "format" | "notFound" | "network" | "tooMany";

export class RestoreError extends Error {
  constructor(public reason: RestoreErrorReason) {
    super(reason);
    this.name = "RestoreError";
  }
}

export const RESTORE_MESSAGES: Record<RestoreErrorReason, string> = {
  format: "복구 코드는 8글자예요. (예: K7Q4-MZ2P)",
  notFound: "그 코드로 등록된 요원을 찾지 못했어요. 글자를 다시 확인해 주세요.",
  network: "본부 서버에 닿지 않아요. 인터넷 연결을 확인해 주세요.",
  tooMany: "시도가 너무 많았어요. 잠시 뒤에 다시 해 주세요.",
};
