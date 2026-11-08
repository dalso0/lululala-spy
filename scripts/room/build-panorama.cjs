// 360° 본부 파노라마 만들기
//   node scripts/room/build-panorama.cjs [video.mp4]
//
// 본부를 한 바퀴 도는 영상의 '가운데 세로 띠'를 프레임마다 이어 붙여(slit-scan) 한 장의 긴 파노라마를 만든다.
//  1) 프레임마다 카메라가 옆으로 돈 양(px)을 잰다
//  2) 앞 절반(오른쪽으로 도는 구간)과 뒤 절반(장면이 끊긴 뒤 반대로 도는 구간)을 각각 이어 붙인다
//  3) 두 조각을 부드럽게 겹쳐 끝과 처음이 이어지는 고리로 만든다
//  4) 살짝 선명하게 다듬어 1024px 타일(WebP)로 자르고, 미리보기와 정보(manifest.json)를 쓴다
// 맥에 설치된 Google Chrome 을 쓴다 (다른 경로면 CHROME=... 로 지정).

const { chromium } = require("playwright-core");
const http = require("http");
const fs = require("fs");
const path = require("path");

const VIDEO = path.resolve(process.argv[2] || "video.mp4");
const OUT = path.resolve("public/art/pano");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
// px 값은 720p 영상 기준. 더 큰 영상이면 높이 비율(K)대로 키운다 → 파노라마 좌표도 같은 비율로 커진다(lib/room.ts 가 맞춘다)
const OPT = {
  fps: 30, // 초당 몇 장을 잴지
  band: 0.9, // 위에서부터 쓸 높이 비율 (아래 10%는 일부 프레임에 글씨가 있어 버린다)
  seg2End: 7.75, // 뒤 절반은 이 시각까지만 (그 뒤는 책상이 한 번 더 나와서 뺀다)
  feather: 14, // 띠 사이를 부드럽게 겹치는 폭
  endExtra: 300, // 조각 끝에서 가운데 띠 바깥으로 더 쓰는 폭
  junction: 200, // 두 조각을 겹치는 폭
  tile: 1024,
  quality: 0.88,
  sharpen: 0.55,
};

function shiftBetween(a, b, maxS, margin) {
  // b 가 a 보다 내용이 왼쪽으로 s 만큼 움직였을 때 b[x - s] ≈ a[x]
  const scores = new Map();
  let best = 0;
  let bestScore = -Infinity;
  for (let s = -maxS; s <= maxS; s++) {
    let num = 0;
    let cnt = 0;
    for (let x = margin; x < a.length - margin; x++) {
      const xb = x - s;
      if (xb < 0 || xb >= b.length) continue;
      num += a[x] * b[xb];
      cnt++;
    }
    const sc = num / cnt;
    scores.set(s, sc);
    if (sc > bestScore) {
      bestScore = sc;
      best = s;
    }
  }
  const l = scores.get(best - 1);
  const r = scores.get(best + 1);
  let sub = 0;
  if (l !== undefined && r !== undefined) {
    const den = l - 2 * bestScore + r;
    if (den < 0) sub = (0.5 * (l - r)) / den;
  }
  return best + sub;
}

(async () => {
  if (!fs.existsSync(VIDEO)) throw new Error("영상이 없습니다: " + VIDEO);
  const server = http
    .createServer((req, res) => {
      if (!req.url.startsWith("/v.mp4")) {
        res.writeHead(200, { "Content-Type": "text/html" });
        return res.end('<video id=v src="/v.mp4" muted playsinline preload=auto></video>');
      }
      const stat = fs.statSync(VIDEO);
      const range = req.headers.range;
      if (range) {
        const [s, e] = range.replace("bytes=", "").split("-");
        const start = +s;
        const end = e ? +e : stat.size - 1;
        res.writeHead(206, { "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Accept-Ranges": "bytes", "Content-Length": end - start + 1, "Content-Type": "video/mp4" });
        fs.createReadStream(VIDEO, { start, end }).pipe(res);
      } else {
        res.writeHead(200, { "Content-Length": stat.size, "Content-Type": "video/mp4" });
        fs.createReadStream(VIDEO).pipe(res);
      }
    })
    .listen(0);
  const port = server.address().port;
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/`);

  // 1) 프레임마다 세로 띠 밝기 변화(열 기울기)를 모은다
  console.log("1/4 프레임 분석 중…");
  const info = await page.evaluate(async ({ fps, band }) => {
    const v = document.getElementById("v");
    for (let i = 0; i < 300 && v.readyState < 2; i++) await new Promise((r) => setTimeout(r, 100));
    const W = v.videoWidth;
    const bandH = Math.round(v.videoHeight * band);
    const y0 = Math.round(v.videoHeight / 12);
    const c = document.createElement("canvas");
    c.width = W;
    c.height = bandH;
    const g = c.getContext("2d", { willReadFrequently: true });
    const seek = (t) => new Promise((r) => { v.onseeked = r; v.currentTime = t; });
    const n = Math.floor(v.duration * fps);
    const times = [];
    const profiles = [];
    for (let i = 0; i < n; i++) {
      const t = Math.min(v.duration - 0.02, (i + 0.5) / fps);
      await seek(t);
      g.drawImage(v, 0, 0, W, bandH, 0, 0, W, bandH);
      const h = bandH - 2 * y0;
      const d = g.getImageData(0, y0, W, h).data;
      const col = new Float32Array(W);
      for (let y = 0; y < h; y++) {
        const row = y * W * 4;
        for (let x = 0; x < W; x++) {
          const k = row + x * 4;
          col[x] += d[k] + d[k + 1] + d[k + 2];
        }
      }
      const grad = new Array(W).fill(0);
      for (let x = 1; x < W; x++) grad[x] = col[x] - col[x - 1];
      times.push(t);
      profiles.push(grad);
    }
    return { W, H: v.videoHeight, bandH, duration: v.duration, times, profiles };
  }, OPT);

  const { times, profiles, W: FW } = info;
  const K = info.H / 720;
  const P = {
    ...OPT,
    bandH: info.bandH,
    feather: Math.round(OPT.feather * K),
    endExtra: Math.round(OPT.endExtra * K),
    junction: Math.round(OPT.junction * K),
  };
  console.log(`  영상 ${FW}×${info.H} · ${info.duration.toFixed(1)}초`);
  const d = [];
  for (let i = 0; i + 1 < profiles.length; i++) d.push(shiftBetween(profiles[i], profiles[i + 1], Math.round(90 * K), Math.round(120 * K)));
  // 앞 절반(+)이 끝나고 장면이 끊기는 곳
  let firstMove = d.findIndex((s) => s > 1 * K);
  let cut = -1;
  for (let i = firstMove; i < d.length; i++) if (d[i] < -1.5 * K) { cut = i; break; }
  if (firstMove < 0 || cut < 0) throw new Error("회전 구간을 찾지 못했습니다");
  const seg1 = Array.from({ length: cut + 1 }, (_, i) => i); // 0..cut
  let end2 = times.findIndex((t) => t > OPT.seg2End);
  if (end2 < 0) end2 = times.length;
  const seg2 = [];
  for (let i = end2 - 1; i >= cut + 1; i--) seg2.push(i); // 시간을 거꾸로 = 화면이 왼쪽으로 흐르게
  const step1 = seg1.slice(0, -1).map((i) => Math.max(0, d[i]));
  const step2 = seg2.slice(0, -1).map((i) => Math.max(0, -d[i - 1]));
  console.log(`  프레임 ${times.length}장 · 앞 절반 ${seg1.length}장(${times[cut].toFixed(2)}s까지) · 뒤 절반 ${seg2.length}장`);

  // 2) 두 조각을 각각 이어 붙이고 3) 고리로 합치고 4) 다듬어서 타일로
  console.log("2/4 이어 붙이는 중…");
  const result = await page.evaluate(
    async ({ OPT, seg1, seg2, step1, step2, times, FW }) => {
      const v = document.getElementById("v");
      const seek = (t) => new Promise((r) => { v.onseeked = r; v.currentTime = t; });
      const H = OPT.bandH;
      const C = FW / 2;
      const frame = document.createElement("canvas");
      frame.width = FW;
      frame.height = H;
      const fg = frame.getContext("2d");

      const buildSegment = async (frames, steps) => {
        const X = [0];
        for (const s of steps) X.push(X[X.length - 1] + s);
        const L = Math.ceil(X[X.length - 1] + 2 * OPT.endExtra);
        const seg = document.createElement("canvas");
        seg.width = L;
        seg.height = H;
        const sg = seg.getContext("2d");
        const centers = [];
        for (let k = 0; k < frames.length; k++) {
          const w = k < steps.length ? steps[k] : 0;
          const first = k === 0;
          const last = k === frames.length - 1;
          if (!first && !last && w < 0.5) continue; // 카메라가 멈춘 프레임
          await seek(times[frames[k]]);
          fg.drawImage(v, 0, 0, FW, H, 0, 0, FW, H);
          const srcL = first ? C - OPT.endExtra : C - OPT.feather;
          const srcR = last ? C + OPT.endExtra : C + w;
          const dstL = X[k] + OPT.endExtra + (srcL - C);
          const sw = srcR - srcL;
          const strip = document.createElement("canvas");
          strip.width = Math.ceil(sw);
          strip.height = H;
          const tg = strip.getContext("2d");
          tg.drawImage(frame, srcL, 0, sw, H, 0, 0, sw, H);
          if (!first) {
            // 왼쪽 가장자리를 부드럽게 (앞 띠와 겹치는 부분).
            // destination-in 은 칠한 곳 바깥을 지우므로 띠 전체를 그라데이션 한 번으로 칠한다
            const grad = tg.createLinearGradient(0, 0, strip.width, 0);
            grad.addColorStop(0, "rgba(0,0,0,0)");
            grad.addColorStop(Math.min(1, OPT.feather / strip.width), "rgba(0,0,0,1)");
            grad.addColorStop(1, "rgba(0,0,0,1)");
            tg.globalCompositeOperation = "destination-in";
            tg.fillStyle = grad;
            tg.fillRect(0, 0, strip.width, H);
          }
          sg.drawImage(strip, dstL, 0);
          centers.push({ t: +times[frames[k]].toFixed(3), x: Math.round(X[k] + OPT.endExtra) });
        }
        return { seg, L, centers };
      };

      const a = await buildSegment(seg1, step1);
      const b = await buildSegment(seg2, step2);
      const F = OPT.junction;
      const W = a.L + b.L - 2 * F;
      const out = document.createElement("canvas");
      out.width = W;
      out.height = H;
      const og = out.getContext("2d");
      og.drawImage(a.seg, 0, 0);
      // 이음매 1: 앞 조각 끝 + 뒤 조각 시작
      const fadeIn = (src, sx, sw, dx, from, to) => {
        const t = document.createElement("canvas");
        t.width = sw;
        t.height = H;
        const tg = t.getContext("2d");
        tg.drawImage(src, sx, 0, sw, H, 0, 0, sw, H);
        const grad = tg.createLinearGradient(0, 0, sw, 0);
        grad.addColorStop(0, `rgba(0,0,0,${from})`);
        grad.addColorStop(Math.min(1, F / sw), `rgba(0,0,0,${to})`);
        grad.addColorStop(1, `rgba(0,0,0,${to})`);
        tg.globalCompositeOperation = "destination-in";
        tg.fillStyle = grad;
        tg.fillRect(0, 0, sw, H);
        og.drawImage(t, dx, 0);
      };
      fadeIn(b.seg, 0, b.L - F, a.L - F, 0, 1);
      // 이음매 2 (고리): 뒤 조각의 마지막 F px 를 맨 앞에 겹친다
      fadeIn(b.seg, b.L - F, F, 0, 1, 0);

      // 살짝 선명하게 (언샤프 마스크)
      const img = og.getImageData(0, 0, W, H);
      const px = img.data;
      const blur = new Float32Array(px.length);
      const tmp = new Float32Array(px.length);
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          const l = (y * W + Math.max(0, x - 1)) * 4;
          const r = (y * W + Math.min(W - 1, x + 1)) * 4;
          for (let ch = 0; ch < 3; ch++) tmp[i + ch] = (px[l + ch] + px[i + ch] + px[r + ch]) / 3;
        }
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          const u = (Math.max(0, y - 1) * W + x) * 4;
          const dn = (Math.min(H - 1, y + 1) * W + x) * 4;
          for (let ch = 0; ch < 3; ch++) blur[i + ch] = (tmp[u + ch] + tmp[i + ch] + tmp[dn + ch]) / 3;
        }
      for (let i = 0; i < px.length; i += 4)
        for (let ch = 0; ch < 3; ch++) px[i + ch] = Math.max(0, Math.min(255, px[i + ch] + OPT.sharpen * (px[i + ch] - blur[i + ch])));
      og.putImageData(img, 0, 0);

      // 타일 · 미리보기
      const tiles = [];
      for (let x = 0; x < W; x += OPT.tile) {
        const tw = Math.min(OPT.tile, W - x);
        const t = document.createElement("canvas");
        t.width = tw;
        t.height = H;
        t.getContext("2d").drawImage(out, x, 0, tw, H, 0, 0, tw, H);
        tiles.push(t.toDataURL("image/webp", OPT.quality));
      }
      const pw = Math.round(W / 8);
      const ph = Math.round(H / 8);
      const p = document.createElement("canvas");
      p.width = pw;
      p.height = ph;
      const pg = p.getContext("2d");
      pg.imageSmoothingQuality = "high";
      pg.drawImage(out, 0, 0, pw, ph);
      const preview = p.toDataURL("image/webp", 0.7);
      // 확인용 한 장짜리 (저장소에는 안 올림)
      const full = out.toDataURL("image/jpeg", 0.85);
      return {
        W,
        H,
        tiles,
        preview,
        full,
        seams: [a.L - F, 0],
        seg1: { from: 0, to: a.L, centers: a.centers },
        seg2: { from: a.L - F, to: W + F, centers: b.centers.map((c) => ({ t: c.t, x: Math.round(c.x + a.L - F) })) },
      };
    },
    { OPT: P, seg1, seg2, step1, step2, times, FW },
  );

  console.log("3/4 타일 저장 중…");
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  let bytes = 0;
  result.tiles.forEach((u, i) => {
    const buf = Buffer.from(u.split(",")[1], "base64");
    bytes += buf.length;
    fs.writeFileSync(path.join(OUT, `${i}.webp`), buf);
  });
  const pv = Buffer.from(result.preview.split(",")[1], "base64");
  fs.writeFileSync(path.join(OUT, "preview.webp"), pv);
  fs.writeFileSync(
    path.join(OUT, "manifest.json"),
    JSON.stringify(
      { w: result.W, h: result.H, tile: OPT.tile, tiles: result.tiles.length, seams: result.seams },
      null,
      1,
    ),
  );
  // 확인용: 한 장짜리 파노라마와 프레임별 위치 (앱에는 안 들어감)
  const debugDir = process.env.DEBUG_OUT;
  if (debugDir) {
    fs.writeFileSync(path.join(debugDir, "pano-full.jpg"), Buffer.from(result.full.split(",")[1], "base64"));
    fs.writeFileSync(path.join(debugDir, "pano-stitch.json"), JSON.stringify({ seg1: result.seg1, seg2: result.seg2 }));
  }
  console.log(`4/4 완료: ${result.W}×${result.H}px, 타일 ${result.tiles.length}장 ${Math.round(bytes / 1024)}KB + 미리보기 ${Math.round(pv.length / 1024)}KB`);
  await browser.close();
  server.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
