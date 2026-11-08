/** public/ 안 파일 주소. 하위 경로(basePath)에 배포해도 깨지지 않게 앞에 붙여 준다. */
export const asset = (path: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${path}`;
