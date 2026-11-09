// 홍보 영상 렌더 설정 (npx remotion render / studio 가 읽는다)
import { Config } from "@remotion/cli/config";

// 맥에 설치된 크롬으로 그린다 (다른 경로면 CHROME 환경변수)
Config.setBrowserExecutable(process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setCrf(16);
Config.setOverwriteOutput(true);
