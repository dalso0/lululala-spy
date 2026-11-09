// 확인용: 몇 프레임만 그림으로 뽑는다.  node scripts/stills.cjs 40 150 250 ...
const path = require("path");
const fs = require("fs");
const { bundle } = require("@remotion/bundler");
const { renderStill, selectComposition } = require("@remotion/renderer");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
(async () => {
  const frames = process.argv.slice(2).map(Number);
  const out = path.join(__dirname, "..", "out", "stills");
  fs.mkdirSync(out, { recursive: true });
  const serveUrl = await bundle({ entryPoint: path.join(__dirname, "..", "src", "index.ts") });
  const composition = await selectComposition({ serveUrl, id: "Promo", browserExecutable: CHROME });
  for (const frame of frames) {
    await renderStill({ composition, serveUrl, frame, output: path.join(out, `${String(frame).padStart(3, "0")}.jpg`), imageFormat: "jpeg", jpegQuality: 85, browserExecutable: CHROME, scale: 0.5 });
  }
  console.log("stills:", frames.join(" "));
})().catch((e) => { console.error(e); process.exit(1); });
