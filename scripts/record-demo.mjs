// Records the SlideScanner demo video for X (v2 — issue #4).
//
// Techniques:
// - Fake cursor + click ripples injected at the <html> level (immune to zoom transforms).
// - Camera zooms are CSS transforms on <main> — GPU-smooth and crisp (DOM scales, not pixels).
// - Intro: injected macOS-desktop overlay whose browser window contains a scaled CLONE of
//   the live landing page; zooming into the window then fading the overlay is a seamless
//   match cut to the real app.
// - Outro: the master-doc drawer is position:fixed INSIDE <main>, so scaling <main>
//   uniformly shrinks the whole app as one unit (safe because main fills the viewport);
//   an injected markdown-file card "ships out" of the shrinking app.
//
// Scene budget (pre-speedup, target ≤ 22s; encode at ~1.15x for a 15–20s final):
//   intro 2.3 + landing 2.3 + flips 2.0 + wand 4.3 + edit-in-place 2.4
//   + deselect 1.6 + flip-to-end 0.9 + drawer 1.9 + outro 2.7 ≈ 20.4s
import { chromium } from 'playwright';
import { mkdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT_DIR, 'recordings');
mkdirSync(OUT_DIR, { recursive: true });

const W = 1920, H = 1080;
const URL_INPUT = 'https://docs.google.com/presentation/d/1xK9mQ2vDemoCoQ2Review/edit';
const EASE = 'cubic-bezier(0.6,0,0.25,1)'; // the single easing family for all camera moves

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
const context = await browser.newContext({
  viewport: { width: W, height: H },
  recordVideo: { dir: OUT_DIR, size: { width: W, height: H } },
});

// ---- pre-warm in a throwaway page: its video is discarded; the real
// recording happens in a fresh page whose video starts clean.
const warm = await context.newPage();
await warm.goto('http://localhost:3000');
// fill can race React hydration (value set before onChange attaches → button stays
// disabled); retry until the submit button enables.
await warm.waitForSelector('input');
await warm.waitForFunction(async () => true); // yield once
for (let i = 0; i < 20; i++) {
  await warm.fill('input', '');
  await warm.type('input', 'x', { delay: 0 });
  if (await warm.locator('button[type=submit]').isEnabled()) break;
  await warm.waitForTimeout(250);
}
await warm.fill('input', URL_INPUT);
await warm.click('button[type=submit]');
await warm.waitForSelector('header');
for (let i = 0; i < 3; i++) { await warm.keyboard.press('ArrowRight'); await warm.waitForTimeout(200); }
await warm.evaluate(() => fetch('/api/extract', { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ presentationId: 'x', pageId: 'g_mock_slide3', elementType: 'chart',
    boundingBox: { x: 800100, y: 1097280, width: 7543800, height: 3543300 },
    pageSize: { width: 9144000, height: 5143500 } }) }));
await warm.waitForTimeout(800);
const warmVideo = warm.video();
await warm.close();

const page = await context.newPage();
await page.goto('http://localhost:3000');
await page.waitForSelector('input');

// ---- inject cursor + ripple overlay on <html> (cursor hidden until after the intro)
await page.evaluate(() => {
  const ARROW = `<svg width="30" height="30" viewBox="0 0 24 24"><path d="M5.5 3.2 L5.5 17.5 L9.2 14.3 L11.6 19.9 L14.2 18.8 L11.8 13.3 L16.7 13 Z" fill="#111" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
  // Distinctive magic wand: violet gradient rod, glowing golden star tip, orbiting mini-sparks.
  const star = (cx, cy, r, fill, op = 1) =>
    `<path d="M${cx} ${cy - r} L${cx + r * 0.28} ${cy - r * 0.28} L${cx + r} ${cy} L${cx + r * 0.28} ${cy + r * 0.28} L${cx} ${cy + r} L${cx - r * 0.28} ${cy + r * 0.28} L${cx - r} ${cy} L${cx - r * 0.28} ${cy - r * 0.28} Z" fill="${fill}" opacity="${op}"/>`;
  const wand = (minus) => {
    const badge = minus
      ? `<line x1='6' y1='30' x2='17' y2='30' stroke='#111' stroke-width='6' stroke-linecap='round'/><line x1='6' y1='30' x2='17' y2='30' stroke='white' stroke-width='3' stroke-linecap='round'/>`
      : '';
    return `<svg width="42" height="42" viewBox="0 0 34 34">
      <defs>
        <linearGradient id="rod" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#7c3aed"/><stop offset="100%" stop-color="#c4b5fd"/>
        </linearGradient>
        <filter id="glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="1.6" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <line x1="10" y1="10" x2="29" y2="29" stroke="#2e1065" stroke-width="5" stroke-linecap="round"/>
      <line x1="10" y1="10" x2="29" y2="29" stroke="url(#rod)" stroke-width="3.4" stroke-linecap="round"/>
      <line x1="11" y1="9.4" x2="18" y2="16.4" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".8"/>
      <g filter="url(#glow)">${star(8, 8, 7.2, '#facc15')}${star(8, 8, 3.1, '#fff7cc')}</g>
      ${star(19, 4.5, 2.6, '#a78bfa', .95)}
      ${star(4.5, 19, 2.1, '#fbbf24', .9)}
      ${badge}
    </svg>`;
  };
  const cur = document.createElement('div');
  cur.id = 'demo-cursor';
  cur.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4));transform:translate(940px,560px);opacity:0;transition:opacity 300ms;';
  cur.innerHTML = ARROW;
  document.documentElement.appendChild(cur);
  window.__demoMinus = false;
  window.__showCursor = (v) => { cur.style.opacity = v ? '1' : '0'; };
  window.addEventListener('mousemove', (e) => {
    cur.style.transform = `translate(${e.clientX - 4}px, ${e.clientY - 3}px)`;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const onCanvas = !!el?.closest('div[style*="aspect-ratio"]');
    cur.innerHTML = onCanvas ? wand(window.__demoMinus) : ARROW;
  }, true);
  window.addEventListener('mousedown', (e) => {
    const r = document.createElement('div');
    r.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px;z-index:2147483646;pointer-events:none;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;border:3px solid #38bdf8;opacity:.95;`;
    r.animate([{ transform: 'scale(.6)', opacity: .95 }, { transform: 'scale(4.2)', opacity: 0 }], { duration: 480, easing: 'cubic-bezier(.2,.6,.3,1)' });
    document.documentElement.appendChild(r);
    setTimeout(() => r.remove(), 500);
  }, true);
  const st = document.createElement('style');
  st.textContent = '*{cursor:none !important}';
  document.head.appendChild(st);
});

// ---- helpers
let mouse = { x: 940, y: 560 };
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
async function moveTo(x, y, ms) {
  const steps = Math.max(2, Math.round(ms / 20));
  const from = { ...mouse };
  for (let i = 1; i <= steps; i++) {
    const k = ease(i / steps);
    await page.mouse.move(from.x + (x - from.x) * k, from.y + (y - from.y) * k);
    await page.waitForTimeout(20);
  }
  mouse = { x, y };
}
async function clickLocator(loc, ms = 350, opts = {}) {
  const box = await loc.boundingBox();
  const x = box.x + box.width * (opts.fx ?? 0.5);
  const y = box.y + box.height * (opts.fy ?? 0.5);
  await moveTo(x, y, ms);
  await page.mouse.down(); await page.waitForTimeout(70); await page.mouse.up();
}
// Camera zoom via CSS transform on <main>. INVARIANT: never call with scale != 1
// while the master-doc drawer is open MID-SCENE — the only sanctioned exception is
// the outro, which scales main uniformly about the viewport center so the fixed
// drawer shrinks coherently with everything else.
async function zoom(scale, ox, oy, ms = 600, extra = '') {
  await page.evaluate(([s, x, y, d, e, ez]) => {
    const m = document.querySelector('main');
    m.style.transition = `transform ${d}ms ${ez}, opacity ${d}ms ${ez}, filter ${d}ms ${ez}`;
    m.style.transformOrigin = `${x}px ${y}px`;
    m.style.transform = s === 1 && !e ? 'none' : `scale(${s})`;
    if (e) Object.assign(m.style, JSON.parse(e));
  }, [scale, ox, oy, ms, extra, EASE]);
  await page.waitForTimeout(ms);
}

// =================== RECORDING TIMELINE ===================
await page.waitForTimeout(700); // head pad (trimmed in post)

// ---- S0: INTRO (~2.3s) — macOS desktop, browser window springs open, camera dives in
await page.evaluate(([EZ]) => {
  const winW = 1400, winH = 850, chrome = 44;
  const winX = (1920 - winW) / 2, winY = (1080 - winH) / 2 + 8;
  const k = winW / 1920; // clone scale so the app fits the window content
  const ov = document.createElement('div');
  ov.id = 'demo-intro';
  ov.style.cssText = 'position:fixed;inset:0;z-index:2147483000;overflow:hidden;';
  ov.innerHTML = `
    <div style="position:absolute;inset:0;background:
      radial-gradient(1200px 800px at 70% 18%, #2a3f6e 0%, transparent 60%),
      radial-gradient(1000px 700px at 22% 80%, #3d2a5e 0%, transparent 55%),
      linear-gradient(180deg,#0e1428 0%,#141b33 55%,#1a1430 100%);"></div>
    <div style="position:absolute;top:0;left:0;right:0;height:30px;background:rgba(18,20,32,.62);backdrop-filter:blur(20px);display:flex;align-items:center;justify-content:space-between;padding:0 16px;font:500 13px -apple-system;color:#e8eaf2;">
      <span style="display:flex;gap:18px;align-items:center;"><span style="font-size:15px;"></span><b>Finder</b><span>File</span><span>Edit</span><span>View</span><span>Go</span></span>
      <span style="display:flex;gap:14px;">Wed Jul 8&nbsp;&nbsp;9:41 AM</span>
    </div>
    <div id="demo-win" style="position:absolute;left:${winX}px;top:${winY}px;width:${winW}px;height:${winH + chrome}px;border-radius:12px;overflow:hidden;box-shadow:0 40px 120px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.08);transform:scale(.05) translateY(900px);opacity:0;">
      <div style="height:${chrome}px;background:#1d1f27;display:flex;align-items:center;padding:0 14px;gap:8px;">
        <span style="width:12px;height:12px;border-radius:50%;background:#ff5f57;"></span>
        <span style="width:12px;height:12px;border-radius:50%;background:#febc2e;"></span>
        <span style="width:12px;height:12px;border-radius:50%;background:#28c840;"></span>
        <span style="flex:1;display:flex;justify-content:center;"><span style="background:#2a2d38;border-radius:8px;padding:4px 60px;font:12px -apple-system;color:#aeb4c4;">localhost:3000</span></span>
        <span style="width:52px;"></span>
      </div>
      <div id="demo-win-content" style="width:${winW}px;height:${winH}px;overflow:hidden;background:#f8fafc;"></div>
    </div>
    <div style="position:absolute;bottom:12px;left:50%;transform:translateX(-50%);display:flex;gap:10px;padding:10px 16px;border-radius:22px;background:rgba(30,34,52,.55);backdrop-filter:blur(24px);box-shadow:0 8px 30px rgba(0,0,0,.35);">
      ${['#3b82f6,#60a5fa', '#f59e0b,#fbbf24', '#10b981,#34d399', '#ef4444,#f87171', '#8b5cf6,#a78bfa', '#0ea5e9,#38bdf8', '#64748b,#94a3b8'].map((g) =>
        `<span style="width:52px;height:52px;border-radius:13px;background:linear-gradient(135deg,${g});"></span>`).join('')}
    </div>`;
  document.documentElement.appendChild(ov);
  // window content = scaled clone of the live landing page (seamless match cut later)
  const clone = document.querySelector('main').cloneNode(true);
  clone.style.cssText = `width:1920px;height:1080px;transform:scale(${k});transform-origin:top left;`;
  ov.querySelector('#demo-win-content').appendChild(clone);
  window.__introZoom = () => {
    const kk = 1920 / winW;
    ov.style.transition = `transform 750ms ${EZ}`;
    ov.style.transformOrigin = `${winX + winW / 2}px ${winY + chrome + winH / 2}px`;
    ov.style.transform = `scale(${kk})`;
  };
  window.__introFade = () => { ov.style.transition = 'opacity 260ms'; ov.style.opacity = '0'; setTimeout(() => ov.remove(), 300); };
}, [EASE]);
await page.waitForTimeout(380); // desktop establishes
await page.evaluate(() => {
  const w = document.getElementById('demo-win');
  w.animate(
    [{ transform: 'scale(.05) translateY(900px)', opacity: 0 },
     { transform: 'scale(1.015) translateY(-6px)', opacity: 1, offset: .82 },
     { transform: 'scale(1) translateY(0)', opacity: 1 }],
    { duration: 620, easing: 'cubic-bezier(0.3,0.8,0.3,1)', fill: 'forwards' });
});
await page.waitForTimeout(950); // spring + settle
await page.evaluate(() => window.__introZoom());
await page.waitForTimeout(790);
await page.evaluate(() => { window.__introFade(); window.__showCursor(true); });
await page.waitForTimeout(300);

// ---- S1: landing (~2.3s) — subtle zoom on the input while the URL types
// (scoped to body: the intro overlay's clone lives under <html> and may not be
// removed yet, which would make a bare 'input' locator ambiguous)
const input = page.locator('body input');
const ib = await input.boundingBox();
const zin = zoom(1.15, ib.x + ib.width / 2, ib.y + ib.height / 2, 450);
await moveTo(ib.x + 60, ib.y + ib.height / 2, 450);
await zin;
await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up();
await page.keyboard.type(URL_INPUT, { delay: 9 });
await page.waitForTimeout(120);
const zout1 = zoom(1, W / 2, H / 2, 420);
await clickLocator(page.locator('button[type=submit]'), 420);
await zout1;
await page.waitForSelector('header');
await page.waitForTimeout(380);

// ---- S2: flip through slides (~2.0s)
await moveTo(700, 560, 300);
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(750);
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(550);

// ---- S3: wand the ARR chart (~4.3s)
const chart = page.locator('div[title^="chart"]');
const cb = await chart.boundingBox();
const ccx = cb.x + cb.width / 2, ccy = cb.y + cb.height / 2;
const zp = zoom(1.5, ccx, ccy, 620);
await moveTo(ccx - 70, ccy - 20, 620);
await zp;
await clickLocator(chart, 260, { fx: 0.47, fy: 0.42 });
await page.waitForTimeout(650); // violet pulse
const zo = zoom(1, ccx, ccy, 500);
await moveTo(1450, 300, 500);
await zo;
await page.waitForTimeout(250); // table lands in the side pane
const chartBlock = page.locator('span:has-text("chart · vision")').locator('..').locator('..');
const bb = await chartBlock.boundingBox();
await zoom(1.45, bb.x + bb.width / 2, Math.min(bb.y + bb.height / 2, H - 220), 620);
await page.waitForTimeout(700);

// ---- S4: EDIT IN PLACE (~2.4s) — fix the vision extraction right in the purple
// block while still zoomed: the model wrote "40%" but the slide says 44%.
const editRect = async () => page.evaluate(() => {
  for (const pm of document.querySelectorAll('.ProseMirror')) {
    const walker = document.createTreeWalker(pm, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const i = n.textContent.indexOf('40%');
      if (i >= 0) {
        const r = document.createRange();
        r.setStart(n, i); r.setEnd(n, i + 2);
        const b = r.getBoundingClientRect();
        return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
      }
    }
  }
  return null;
});
const er = await editRect();
await moveTo(er.x, er.y, 420);
await page.mouse.dblclick(er.x, er.y, { delay: 60 });
await page.waitForTimeout(280);
await page.keyboard.type('44', { delay: 70 });
await page.waitForTimeout(820); // "edited" badge breathes

// ---- S5: DESELECT (~1.6s) — ⌘-click the disclaimer off this same page
await zoom(1, W / 2, H / 2, 460);
const disc = page.locator('div[title^="text"][title*="auto-extracted"]').last();
await page.keyboard.down('Meta');
await page.evaluate(() => { window.__demoMinus = true; });
await clickLocator(disc, 480);
await page.keyboard.up('Meta');
await page.evaluate(() => { window.__demoMinus = false; });
await page.waitForTimeout(430);

// ---- S5b: page is done — flip through the rest of the deck (~0.9s)
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(850);

// ---- S6: master document drawer, scroll through the whole doc (~2.6s)
await clickLocator(page.locator('button:has-text("Document ·")'), 400);
await page.waitForTimeout(380);
await page.evaluate(() => {
  const pre = document.querySelector('pre');
  const start = performance.now(), dur = 1700, target = pre.scrollHeight - pre.clientHeight;
  const tick = (t) => {
    const k = Math.min(1, (t - start) / dur);
    pre.scrollTop = target * (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
await moveTo(1200, 500, 550);
await page.waitForTimeout(1350);

// ---- S7: OUTRO (~3.0s) — mirror of the intro: match-cut back to the macOS
// desktop (overlay starts zoomed so its window content aligns with the live app),
// the browser window shrinks back to windowed size, and the markdown card ships
// out of the window onto the desktop.
await page.evaluate(([EZ]) => {
  window.__showCursor(false);
  const winW = 1400, winH = 850, chrome = 44;
  const winX = (1920 - winW) / 2, winY = (1080 - winH) / 2 + 8;
  const k = winW / 1920, kk = 1920 / winW;
  const md = document.querySelector('pre')?.textContent ?? '';
  const lines = md.split('\n').filter((l, i) => i < 11).join('\n');
  const ov = document.createElement('div');
  ov.id = 'demo-outro';
  ov.style.cssText = `position:fixed;inset:0;z-index:2147483300;overflow:hidden;opacity:0;transform-origin:${winX + winW / 2}px ${winY + chrome + winH / 2}px;transform:scale(${kk});`;
  ov.innerHTML = `
    <div style="position:absolute;inset:0;background:
      radial-gradient(1200px 800px at 70% 18%, #2a3f6e 0%, transparent 60%),
      radial-gradient(1000px 700px at 22% 80%, #3d2a5e 0%, transparent 55%),
      linear-gradient(180deg,#0e1428 0%,#141b33 55%,#1a1430 100%);"></div>
    <div style="position:absolute;top:0;left:0;right:0;height:30px;background:rgba(18,20,32,.62);backdrop-filter:blur(20px);display:flex;align-items:center;justify-content:space-between;padding:0 16px;font:500 13px -apple-system;color:#e8eaf2;">
      <span style="display:flex;gap:18px;align-items:center;"><span style="font-size:15px;"></span><b>Finder</b><span>File</span><span>Edit</span><span>View</span><span>Go</span></span>
      <span style="display:flex;gap:14px;">Wed Jul 8&nbsp;&nbsp;9:41 AM</span>
    </div>
    <div style="position:absolute;left:${winX}px;top:${winY}px;width:${winW}px;height:${winH + chrome}px;border-radius:12px;overflow:hidden;box-shadow:0 40px 120px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.08);">
      <div style="height:${chrome}px;background:#1d1f27;display:flex;align-items:center;padding:0 14px;gap:8px;">
        <span style="width:12px;height:12px;border-radius:50%;background:#ff5f57;"></span>
        <span style="width:12px;height:12px;border-radius:50%;background:#febc2e;"></span>
        <span style="width:12px;height:12px;border-radius:50%;background:#28c840;"></span>
        <span style="flex:1;display:flex;justify-content:center;"><span style="background:#2a2d38;border-radius:8px;padding:4px 60px;font:12px -apple-system;color:#aeb4c4;">localhost:3000</span></span>
        <span style="width:52px;"></span>
      </div>
      <div id="demo-outro-content" style="width:${winW}px;height:${winH}px;overflow:hidden;background:#f8fafc;"></div>
    </div>
    <div style="position:absolute;bottom:12px;left:50%;transform:translateX(-50%);display:flex;gap:10px;padding:10px 16px;border-radius:22px;background:rgba(30,34,52,.55);backdrop-filter:blur(24px);box-shadow:0 8px 30px rgba(0,0,0,.35);">
      ${['#3b82f6,#60a5fa', '#f59e0b,#fbbf24', '#10b981,#34d399', '#ef4444,#f87171', '#8b5cf6,#a78bfa'].map((g) =>
        `<span style="width:52px;height:52px;border-radius:13px;background:linear-gradient(135deg,${g});"></span>`).join('')}
      <span id="demo-claude" style="width:52px;height:52px;border-radius:13px;background:#faf9f5;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 0 0 1px rgba(0,0,0,.06);">
        <svg width="34" height="34" viewBox="0 0 34 34">
          <g stroke="#d97757" stroke-width="3.6" stroke-linecap="round">
            ${Array.from({ length: 10 }, (_, i) => {
              const a = (i / 10) * Math.PI * 2 + 0.25;
              const r1 = 3.4, r2 = i % 2 ? 10.5 : 13.5;
              return `<line x1="${17 + r1 * Math.cos(a)}" y1="${17 + r1 * Math.sin(a)}" x2="${17 + r2 * Math.cos(a)}" y2="${17 + r2 * Math.sin(a)}"/>`;
            }).join('')}
          </g>
        </svg>
      </span>
      <span style="width:52px;height:52px;border-radius:13px;background:linear-gradient(135deg,#64748b,#94a3b8);"></span>
    </div>
    <div id="demo-card" style="position:absolute;left:50%;top:51%;width:560px;transform:translate(-50%,-50%) scale(.3);opacity:0;border-radius:18px;background:#fff;box-shadow:0 24px 50px rgba(2,6,18,.4),0 60px 140px rgba(2,6,18,.5);overflow:hidden;">
      <div style="display:flex;align-items:center;gap:10px;padding:13px 18px;border-bottom:1px solid #e8ecf3;font:600 14px -apple-system;color:#1e293b;">
        <span style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:7px;background:#0f172a;color:#fff;font:700 9px -apple-system;">MD</span>
        democo-q2-2026-business-review.md
        <span style="margin-left:auto;font:500 11px -apple-system;color:#94a3b8;">LLM-ready</span>
      </div>
      <pre style="margin:0;padding:18px 20px;font:12.5px/1.7 ui-monospace,Menlo,monospace;color:#334155;white-space:pre-wrap;">${lines.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>
    </div>
    <div id="demo-brand" style="position:absolute;left:50%;top:80%;transform:translateX(-50%);opacity:0;transition:opacity 450ms ${EZ};font:700 21px -apple-system;color:#f4f6fb;background:rgba(13,16,30,.88);padding:10px 26px;border-radius:999px;box-shadow:0 12px 40px rgba(0,0,0,.45);">SlideScanner</div>`;
  document.documentElement.appendChild(ov);
  // window content = scaled clone of the live app (drawer open) for a seamless match cut
  const clone = document.querySelector('main').cloneNode(true);
  clone.style.cssText = `width:1920px;height:1080px;transform:scale(${k});transform-origin:top left;`;
  ov.querySelector('#demo-outro-content').appendChild(clone);
  // cloneNode does not carry scroll state — sync the drawer's scroll position
  const livePre = document.querySelector('main pre');
  const clonePre = clone.querySelector('pre');
  if (livePre && clonePre) clonePre.scrollTop = livePre.scrollTop;
}, [EASE]);
await page.waitForTimeout(80);
// match cut: overlay (pre-zoomed onto the window) fades over the live app
await page.evaluate(() => {
  const ov = document.getElementById('demo-outro');
  ov.style.transition = 'opacity 160ms';
  ov.style.opacity = '1';
});
await page.waitForTimeout(220);
// zoom back out to the desktop
await page.evaluate(([EZ]) => {
  const ov = document.getElementById('demo-outro');
  ov.style.transition = `transform 850ms ${EZ}`;
  ov.style.transform = 'scale(1)';
}, [EASE]);
await page.waitForTimeout(950);
// the markdown ships out of the window onto the desktop
await page.evaluate(() => {
  document.getElementById('demo-card').animate(
    [{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 0 },
     { transform: 'translate(-50%,-52%) scale(1.03)', opacity: 1, offset: .78 },
     { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }],
    { duration: 800, easing: 'cubic-bezier(0.3,0.8,0.3,1)', fill: 'forwards' });
});
await page.waitForTimeout(1150);
// …then paper-planes into the Claude app in the dock (banking arc, shrink, deliver)
await page.evaluate(() => {
  const claude = document.getElementById('demo-claude');
  const cb = claude.getBoundingClientRect();
  const card = document.getElementById('demo-card');
  const base = { x: 960, y: 1080 * 0.51 }; // card anchor (left:50%, top:51%)
  const dx = cb.x + cb.width / 2 - base.x, dy = cb.y + cb.height / 2 - base.y;
  card.animate(
    [{ transform: 'translate(-50%,-50%) scale(1) rotate(0deg)', opacity: 1 },
     { transform: `translate(calc(-50% + ${dx * 0.32}px), calc(-50% + ${dy * 0.30}px)) scale(.5) rotate(-11deg)`, opacity: 1, offset: .45 },
     { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.04) rotate(-20deg)`, opacity: .85 }],
    { duration: 850, easing: 'cubic-bezier(0.5,0,0.45,1)', fill: 'forwards' });
  setTimeout(() => {
    card.style.display = 'none';
    // dock bounce + glow on delivery
    claude.animate(
      [{ transform: 'translateY(0)' }, { transform: 'translateY(-18px)', offset: .35 },
       { transform: 'translateY(0)', offset: .68 }, { transform: 'translateY(-7px)', offset: .84 },
       { transform: 'translateY(0)' }],
      { duration: 620, easing: 'cubic-bezier(0.35,0.6,0.35,1)' });
    claude.animate(
      [{ boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.06), 0 0 0px rgba(217,119,87,0)' },
       { boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.06), 0 0 26px rgba(217,119,87,.9)', offset: .3 },
       { boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.06), 0 0 0px rgba(217,119,87,0)' }],
      { duration: 900 });
  }, 830);
});
await page.waitForTimeout(1500);
await page.evaluate(() => { document.getElementById('demo-brand').style.opacity = '1'; });
await page.waitForTimeout(900);

const video = page.video();
await context.close();
const path = await video.path();
try { unlinkSync(await warmVideo.path()); } catch {}
console.log('VIDEO:', path);
await browser.close();
