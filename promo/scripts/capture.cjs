// 앱 화면을 프레임 단위로 녹화한다 (홍보 영상용).
//   node scripts/capture.cjs [장면...]      예) node scripts/capture.cjs bomb mirror
//
// 브라우저의 시계를 멈춰 두고(가상 시계) 1/30초씩 직접 넘기며 한 장씩 찍는다.
// 그래서 컴퓨터가 느려도 움직임이 끊기지 않고, 폰 화면과 똑같은 앱이 프레임마다 또렷하게 남는다.
// 앱은 먼저 빌드해서 띄워 둔다: (spy 폴더에서) NEXT_PUBLIC_BASE_PATH=/lululala-spy npm run build → out/ 을 서빙.
// 결과: public/clips/<장면>/0000.jpg … + public/clips/<장면>.json (클릭한 프레임 = 효과음 넣을 자리)

const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");

const BASE = process.env.BASE || "http://localhost:3200/lululala-spy";
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = path.join(__dirname, "..", "public", "clips");
const FPS = 30;
const DPR = 2;

// 페이지의 시간을 가상으로: setTimeout·rAF·performance.now·Date.now·CSS/WAAPI 애니메이션
const VCLOCK = `(() => {
  const rSetTimeout = window.setTimeout.bind(window);
  const D0 = Date.now();
  let now = 0, id = 0;
  const timers = new Map();
  const rafs = new Map();
  window.setTimeout = (fn, ms, ...args) => { const i = ++id; timers.set(i, { at: now + Math.max(0, +ms || 0), fn, args, every: 0 }); return i; };
  window.setInterval = (fn, ms, ...args) => { const i = ++id; const every = Math.max(1, +ms || 0); timers.set(i, { at: now + every, fn, args, every }); return i; };
  window.clearTimeout = window.clearInterval = (i) => { timers.delete(i); };
  window.requestAnimationFrame = (cb) => { const i = ++id; rafs.set(i, cb); return i; };
  window.cancelAnimationFrame = (i) => { rafs.delete(i); };
  performance.now = () => now;
  Date.now = () => D0 + now;
  const seen = new WeakMap();
  const syncAnims = () => {
    for (const a of document.getAnimations()) {
      let base = seen.get(a);
      if (base === undefined) {
        base = now - (Number(a.currentTime) || 0);
        seen.set(a, base);
        try { a.pause(); } catch {}
      }
      try { a.currentTime = Math.max(0, now - base); } catch {}
    }
  };
  const runTimers = (until) => {
    for (let guard = 0; guard < 20000; guard++) {
      let best = null;
      for (const [i, t] of timers) if (t.at <= until && (!best || t.at < best[1].at)) best = [i, t];
      if (!best) break;
      const [i, t] = best;
      now = Math.max(now, t.at);
      if (t.every) t.at += t.every; else timers.delete(i);
      try { typeof t.fn === "function" ? t.fn(...t.args) : (0, eval)(t.fn); } catch (e) { console.error(e); }
    }
    now = until;
  };
  window.__vc = {
    now: () => now,
    step(ms) {
      runTimers(now + ms);
      const cbs = [...rafs.values()];
      rafs.clear();
      for (const cb of cbs) { try { cb(now); } catch (e) { console.error(e); } }
      syncAnims();
    },
    // React 가 화면에 반영할 틈 (진짜 시간)
    flush: () => new Promise((r) => rSetTimeout(() => rSetTimeout(r, 0), 0)),
  };
})();`;

const pad = (i) => String(i).padStart(4, "0");

async function setup(browser, storage) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: DPR, hasTouch: false });
  await ctx.addInitScript(VCLOCK);
  if (storage) await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s.local || {})) localStorage.setItem(k, v); for (const [k, v] of Object.entries(s.session || {})) sessionStorage.setItem(k, v); }, storage);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("  [pageerror]", e.message));
  const step = (ms) => page.evaluate(async (ms) => { window.__vc.step(ms); await window.__vc.flush(); }, ms);
  /** 녹화 없이 시간 보내기 (그사이 그림·네트워크도 기다린다) */
  const settle = async (ms) => {
    for (let t = 0; t < ms; t += 50) {
      await step(50);
      await page.waitForTimeout(8);
    }
  };
  return { ctx, page, step, settle };
}

/** 장면 하나 녹화: script(f, ctl) 는 매 프레임 직전에 불린다. ctl.mark(이름) 로 효과음 자리를 남긴다 */
async function record(name, { page, step }, frames, script) {
  const dir = path.join(OUT, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const marks = [];
  const ctl = { mark: (label) => marks.push({ frame: ctl.f, label }), f: 0 };
  for (let f = 0; f < frames; f++) {
    ctl.f = f;
    if (script) await script(f, ctl);
    await step(1000 / FPS);
    await page.screenshot({ path: path.join(dir, `${pad(f)}.jpg`), type: "jpeg", quality: 92 });
  }
  fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify({ frames, fps: FPS, marks }, null, 1));
  console.log(`  ${name}: ${frames}프레임 · 소리 자리 ${marks.map((m) => `${m.label}@${m.frame}`).join(" ") || "-"}`);
}

const DONE_ALL = ["m0_daily", "m1_breathing", "m2_mirror"];
const spyState = (cleared, seen = cleared) => ({
  local: {
    "spy-v1": JSON.stringify({ codename: "노란 토끼 #B50A", recoveryCode: "49W3-RAPN", clearedMissions: cleared, pixels: cleared.length, dailyDone: cleared.includes("m0_daily") ? ["sky"] : [], isLoggedIn: true }),
    "spy-seen": JSON.stringify({ cleared: seen }),
  },
});

const SCENES = {
  // 첫 화면 → 요원 신분 받기 → 요원명 카드
  async start(browser) {
    const s = await setup(browser);
    await s.page.goto(BASE + "/");
    await s.settle(150);
    await record("start", s, 108, async (f, ctl) => {
      if (f === 42) {
        ctl.mark("tap");
        await s.page.getByRole("button", { name: "요원 신분 받기" }).click();
      }
    });
    await s.ctx.close();
  },

  // 평범지령: 두 개 체크 → 완료 → 방화벽 돌파 + 늘곰 SOS
  async daily(browser) {
    const s = await setup(browser, spyState([]));
    await s.page.goto(BASE + "/mission/m0_daily/");
    await s.settle(1500);
    await record("daily", s, 132, async (f, ctl) => {
      if (f === 10) { ctl.mark("check"); await s.page.getByText("하늘 사진 한 장 찍기").click(); }
      if (f === 26) { ctl.mark("check"); await s.page.getByText("물 한 컵 천천히 마시기").click(); }
      if (f === 44) { ctl.mark("done"); await s.page.getByRole("button", { name: /완료 · 본부에 보고/ }).click(); }
    });
    await s.ctx.close();
  },

  // 스트레스 시한폭탄: 해체 시작 → 들이쉬기
  async bomb(browser) {
    const s = await setup(browser, spyState(["m0_daily"]));
    await s.page.goto(BASE + "/mission/m1_breathing/");
    await s.settle(1500);
    await record("bomb", s, 120, async (f, ctl) => {
      if (f === 6) { ctl.mark("start"); await s.page.getByRole("button", { name: "해체 시작" }).click(); }
    });
    await s.ctx.close();
  },

  // 진실의 거울 방: 의심의 말을 끌어 휴지통에 → 마지막엔 암호 새기기 → 거울이 깨진다
  async mirror(browser) {
    const s = await setup(browser, spyState(["m0_daily", "m1_breathing"]));
    const { page } = s;
    await page.goto(BASE + "/mission/m2_mirror/");
    await page.waitForSelector("button[aria-pressed]");
    await s.settle(2600);
    const trash = await page.getByRole("button", { name: "휴지통", exact: true }).boundingBox();
    const tc = { x: trash.x + trash.width / 2, y: trash.y + trash.height * 0.4 };
    const center = async (i) => {
      const b = await page.locator("button[aria-pressed]").nth(i).boundingBox();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    };
    // 한 장면: 첫 말 끌어 버리기 (프레임 사이에 손가락을 조금씩 옮긴다)
    let from = null;
    const DRAG = 16;
    await record("mirror", s, 72, async (f, ctl) => {
      if (f === 4) {
        from = await center(0);
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        ctl.mark("grab");
      }
      if (f > 4 && f <= 4 + DRAG) {
        const k = (f - 4) / DRAG;
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        await page.mouse.move(from.x + (tc.x + 10 - from.x) * e, from.y + (tc.y - from.y) * e);
      }
      if (f === 5 + DRAG) { ctl.mark("throw"); await page.mouse.up(); }
    });
    // 나머지 둘은 빨리 버리고 암호 새기기 → 깨지는 장면만 녹화
    for (let n = 0; n < 2; n++) {
      const c = await center(0);
      await page.mouse.move(c.x, c.y);
      await page.mouse.down();
      for (let k = 1; k <= 8; k++) {
        await page.mouse.move(c.x + ((tc.x - c.x) * k) / 8, c.y + ((tc.y - c.y) * k) / 8);
        await s.step(30);
      }
      await page.mouse.up();
      await s.settle(1400);
    }
    await s.settle(1200);
    await page.getByRole("button", { name: "포기하지 않는", exact: true }).click();
    await s.settle(400);
    await record("mirror-break", s, 84, async (f, ctl) => {
      if (f === 3) { ctl.mark("carve"); await page.getByRole("button", { name: "암호 새기기", exact: true }).click(); }
    });
    await s.ctx.close();
  },

  // 픽셀 장착 의식: 장치 가방 → 픽셀 코어를 누르면 자물쇠에 꽂히고 톱니가 돈다
  async ceremony(browser) {
    const s = await setup(browser, { ...spyState(["m0_daily", "m1_breathing"], ["m0_daily"]), session: { "spy-hq-powered": "1", "spy-room-pan": "580" } });
    await s.page.goto(BASE + "/dashboard/");
    await s.settle(900);
    await record("ceremony", s, 126, async (f, ctl) => {
      if (f === 8) { ctl.mark("insert"); await s.page.getByRole("button", { name: "픽셀 코어 장착하기" }).click({ force: true }); }
    });
    await s.ctx.close();
  },
};

(async () => {
  const which = process.argv.slice(2);
  const names = which.length ? which : Object.keys(SCENES);
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  for (const n of names) {
    if (!SCENES[n]) throw new Error("모르는 장면: " + n);
    console.log(`녹화: ${n}`);
    await SCENES[n](browser);
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
