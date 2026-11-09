// video7(다른 모델이 만든 시네마틱 영상)의 오른쪽 아래 ✦ 표시를 지운다.
//   node scripts/clean-v7.cjs        → public/footage/v7.mp4 (소리는 원본 그대로 복사)
//
// ✦ 는 모든 프레임의 같은 자리에 '반투명 흰 별'로 덧씌워져 있다:  보이는 색 = a·흰색 + (1-a)·원래 색
//  1) 240장 중 별 둘레가 고른 프레임들에서 자리마다 a(투명도)를 잰다 (중앙값이라 장면이 바뀌어도 흔들리지 않는다)
//  2) 모든 프레임에서 거꾸로 풀어 원래 색을 되살린다 — 흐리게 덮는 방식과 달리 바닥 무늬 · 전선이 그대로 살아 있다
//  3) 별 테두리에 남는 압축 얼룩만 주변 색으로 살짝 메운다
// DEBUG=1 이면 out/v7/debug/ 에 전후 비교 그림을 남긴다.

const { chromium } = require("playwright-core");
const { execFileSync } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "..", "video7.mp4");
const OUT = path.join(ROOT, "public", "footage", "v7.mp4");
const WORK = path.join(ROOT, "out", "v7");
const DEBUG = !!process.env.DEBUG;
// 별 둘레 상자 (720×1280 원본 px). 별은 (576..624, 1136..1184) 안에 있다.
const BOX = { x: 552, y: 1112, w: 96, h: 96 };

const ffmpeg = (args) => execFileSync("npx", ["remotion", "ffmpeg", "-hide_banner", "-v", "error", "-y", ...args], { cwd: ROOT, stdio: "inherit" });

(async () => {
  for (const d of ["in", "fix", "debug"]) fs.rmSync(path.join(WORK, d), { recursive: true, force: true });
  for (const d of ["in", "fix", "debug"]) fs.mkdirSync(path.join(WORK, d), { recursive: true });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });

  console.log("1/4 프레임 풀기…");
  ffmpeg(["-i", SRC, "-pix_fmt", "rgb24", path.join(WORK, "in", "%04d.png")]);
  const frames = fs.readdirSync(path.join(WORK, "in")).filter((f) => f.endsWith(".png")).sort();

  const server = http
    .createServer((req, res) => {
      const m = req.url.match(/^\/in\/(\d{4}\.png)$/);
      if (m) {
        res.writeHead(200, { "Content-Type": "image/png" });
        return fs.createReadStream(path.join(WORK, "in", m[1])).pipe(res);
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<!doctype html><title>clean</title>");
    })
    .listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage();
  await page.goto(base + "/");

  await page.evaluate(
    ({ BOX, n }) => {
      const W = BOX.w, H = BOX.h;
      const load = async (i) => {
        const blob = await (await fetch(`/in/${String(i + 1).padStart(4, "0")}.png`)).blob();
        return createImageBitmap(blob, { colorSpaceConversion: "none", premultiplyAlpha: "none" });
      };
      const cv = new OffscreenCanvas(W, H);
      const g = cv.getContext("2d", { willReadFrequently: true });
      const region = async (i) => {
        const bm = await load(i);
        g.clearRect(0, 0, W, H);
        g.drawImage(bm, -BOX.x, -BOX.y);
        bm.close();
        return g.getImageData(0, 0, W, H);
      };
      // 안쪽 상자(별 + 여유) 바깥 테두리에서 안쪽으로 이어 그린 '바탕' 추정 (delogo 방식: 네 변에서 거리 가중 보간)
      const IN = { x0: 18, y0: 18, x1: 78, y1: 78 };
      const interp = (d, c) => {
        const out = new Float32Array(W * H);
        const at = (x, y) => d[(y * W + x) * 4 + c];
        for (let y = IN.y0; y < IN.y1; y++)
          for (let x = IN.x0; x < IN.x1; x++) {
            const L = at(IN.x0 - 1, y), R = at(IN.x1, y), T = at(x, IN.y0 - 1), B = at(x, IN.y1);
            const dl = x - IN.x0 + 1, dr = IN.x1 - x, dt = y - IN.y0 + 1, db = IN.y1 - y;
            const h = (L * dr + R * dl) / (dl + dr), v = (T * db + B * dt) / (dt + db);
            const wh = 1 / Math.min(dl, dr), wv = 1 / Math.min(dt, db);
            out[y * W + x] = (h * wh + v * wv) / (wh + wv);
          }
        return out;
      };
      // 테두리가 고른지(표준편차)
      const ringStd = (d) => {
        let s = 0, s2 = 0, k = 0;
        for (let y = IN.y0 - 2; y < IN.y1 + 2; y++)
          for (let x = IN.x0 - 2; x < IN.x1 + 2; x++) {
            if (x >= IN.x0 && x < IN.x1 && y >= IN.y0 && y < IN.y1) continue;
            const i = (y * W + x) * 4, v = (d[i] + d[i + 1] + d[i + 2]) / 3;
            s += v; s2 += v * v; k++;
          }
        const m = s / k;
        return { std: Math.sqrt(Math.max(0, s2 / k - m * m)), mean: m };
      };
      window.__clean = { W, H, IN, region, interp, ringStd, load, n };
    },
    { BOX, n: frames.length },
  );

  console.log("2/4 별의 투명도 재기…");
  const stats = await page.evaluate(async () => {
    const { W, H, IN, region, interp, ringStd, n } = window.__clean;
    const samples = []; // 자리마다 a 후보들
    for (let p = 0; p < W * H; p++) samples.push([]);
    let used = 0;
    for (let i = 0; i < n; i++) {
      const im = await region(i);
      const d = im.data;
      const r = ringStd(d);
      if (r.std > 7) continue; // 둘레가 복잡한 프레임은 바탕 추정이 틀리므로 건너뛴다
      used++;
      const bg = [0, 1, 2].map((c) => interp(d, c));
      for (let y = IN.y0; y < IN.y1; y++)
        for (let x = IN.x0; x < IN.x1; x++) {
          const p = y * W + x;
          let o = 0, b = 0;
          for (let c = 0; c < 3; c++) { o += d[p * 4 + c]; b += bg[c][p]; }
          o /= 3; b /= 3;
          if (255 - b < 40) continue;
          samples[p].push((o - b) / (255 - b));
        }
    }
    const med = (a) => { if (!a.length) return 0; const s = a.slice().sort((p, q) => p - q); return s[s.length >> 1]; };
    const alpha = new Float32Array(W * H);
    for (let p = 0; p < W * H; p++) alpha[p] = Math.max(0, med(samples[p]));
    window.__clean.alpha = alpha;
    return { used, center: alpha[48 * W + 48] };
  });
  console.log("   둘레가 고른 프레임", stats.used, "장으로 잼 · 별 한가운데 a =", stats.center.toFixed(3));


  console.log("3/4 모든 프레임에서 별 지우기…");
  for (let i = 0; i < frames.length; i++) {
    const png = await page.evaluate(
      async ({ i, BOX, debug }) => {
        const { W, H, IN, alpha, load } = window.__clean;
        const bm = await load(i);
        const full = new OffscreenCanvas(bm.width, bm.height);
        const fg = full.getContext("2d", { willReadFrequently: true });
        fg.drawImage(bm, 0, 0);
        bm.close();
        const im = fg.getImageData(BOX.x, BOX.y, W, H);
        const before = new Uint8ClampedArray(im.data);
        const d = im.data;
        const WH = 255;
        // 1) 거꾸로 풀기
        for (let p = 0; p < W * H; p++) {
          const a = alpha[p];
          if (a < 0.012) continue;
          for (let c = 0; c < 3; c++) d[p * 4 + c] = (d[p * 4 + c] - a * WH) / (1 - a);
        }
        // 2) 별 테두리(a 가 급히 변하는 곳)의 압축 얼룩: 3×3 중앙값으로 살짝 고른다
        const src = new Uint8ClampedArray(d);
        for (let y = IN.y0; y < IN.y1; y++)
          for (let x = IN.x0; x < IN.x1; x++) {
            const p = y * W + x;
            let lo = 1, hi = 0;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const a = alpha[p + dy * W + dx]; lo = Math.min(lo, a); hi = Math.max(hi, a); }
            if (hi - lo < 0.08) continue;
            for (let c = 0; c < 3; c++) {
              const v = [];
              for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) v.push(src[(p + dy * W + dx) * 4 + c]);
              v.sort((m, n) => m - n);
              d[p * 4 + c] = v[4];
            }
          }
        fg.putImageData(im, BOX.x, BOX.y);
        const toUrl = async (c) => {
          const b = await c.convertToBlob({ type: "image/png" });
          return new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); });
        };
        const out = { full: await toUrl(full) };
        if (debug) {
          // 전후 비교 (5배 확대)
          const S = 5, cmp = new OffscreenCanvas(W * S * 2 + 8, H * S), cg = cmp.getContext("2d");
          cg.imageSmoothingEnabled = false;
          const tmp = new OffscreenCanvas(W, H), tg = tmp.getContext("2d");
          tg.putImageData(new ImageData(before, W, H), 0, 0);
          cg.drawImage(tmp, 0, 0, W * S, H * S);
          tg.putImageData(im, 0, 0);
          cg.drawImage(tmp, W * S + 8, 0, W * S, H * S);
          out.cmp = await toUrl(cmp);
        }
        return out;
      },
      { i, BOX, debug: DEBUG && i % 24 === 12 },
    );
    const bin = (url) => Buffer.from(url.slice(url.indexOf(",") + 1), "base64");
    fs.writeFileSync(path.join(WORK, "fix", frames[i]), bin(png.full));
    if (png.cmp) fs.writeFileSync(path.join(WORK, "debug", `cmp_${frames[i]}`), bin(png.cmp));
    if (i % 48 === 0) process.stdout.write(`   ${i}/${frames.length}\n`);
  }
  await browser.close();
  server.close();

  console.log("4/4 다시 묶기 (소리는 원본 그대로)…");
  ffmpeg([
    "-framerate", "24", "-i", path.join(WORK, "fix", "%04d.png"), "-i", SRC,
    "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-crf", "10", "-preset", "slow", "-pix_fmt", "yuv420p",
    "-colorspace", "smpte170m", "-color_primaries", "bt709", "-color_trc", "iec61966-2-1", "-color_range", "tv",
    "-c:a", "copy", "-movflags", "+faststart", OUT,
  ]);
  if (!DEBUG) for (const d of ["in", "fix"]) fs.rmSync(path.join(WORK, d), { recursive: true, force: true });
  console.log("끝:", path.relative(ROOT, OUT), (fs.statSync(OUT).size / 1e6).toFixed(1), "MB");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
