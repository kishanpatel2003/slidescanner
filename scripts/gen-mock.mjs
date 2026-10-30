// Generates the mock deck: lib/mockDeck.json + public/mock/slide-N.png
// One source of truth for element geometry (px at 1600x900) and slide artwork.
// Demo v2 (issue #4): Fictional DemoCo business review — synthetic demonstration data.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PX_W = 1600, PX_H = 900;
const EMU = 5715; // 9144000 / 1600
const emu = (r) => ({ x: r.x * EMU, y: r.y * EMU, width: r.w * EMU, height: r.h * EMU });

const font = `-apple-system, 'Helvetica Neue', Arial, sans-serif`;
const BG = '#0a0a12';
const BLUE = '#3b82f6', BLUE_LT = '#60a5fa', INK = '#f4f6fb', MUTE = '#8b93a7';
const baseCss = `
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:${PX_W}px; height:${PX_H}px; overflow:hidden; font-family:${font}; background:${BG}; }
  .abs { position:absolute; }
  .wordmark { font-weight:800; letter-spacing:-1px; color:${INK}; }
  .wordmark b { color:${BLUE_LT}; }
`;
const wordmark = (size, x, y) =>
  `<div class="abs wordmark" style="left:${x}px;top:${y}px;font-size:${size}px;">democo<b>.</b></div>`;
const disclaimer = () =>
  `<div class="abs" style="left:100px;top:836px;width:460px;height:40px;font-size:21px;color:#4b5266;">Fictional company · Synthetic data</div>`;
const accentRule = (x, y) =>
  `<div class="abs" style="left:${x}px;top:${y}px;width:120px;height:5px;background:linear-gradient(90deg,${BLUE},${BLUE_LT});border-radius:3px;box-shadow:0 0 14px ${BLUE}66;"></div>`;

// ---------------------------------------------------------------- slide 1 — title
const s1 = {
  slideId: 'g_mock_slide1',
  html: `
    <div class="abs" style="left:1000px;top:120px;width:640px;height:640px;border-radius:50%;background:radial-gradient(circle at 42% 40%, ${BLUE_LT}55 0%, ${BLUE}33 34%, transparent 68%);"></div>
    <div class="abs" style="left:1210px;top:330px;width:220px;height:220px;border-radius:50%;background:radial-gradient(circle at 45% 42%, #dbeafe 0%, ${BLUE_LT} 42%, ${BLUE} 100%);box-shadow:0 0 90px ${BLUE}aa;"></div>
    ${wordmark(46, 120, 118)}
    <div class="abs" style="left:118px;top:330px;width:1000px;height:180px;color:${INK};font-size:84px;font-weight:800;letter-spacing:-2.5px;line-height:1.06;">Q2 2026<br>Business Review</div>
    <div class="abs" style="left:122px;top:560px;width:760px;height:56px;color:${MUTE};font-size:31px;font-weight:500;">Product demonstration · Synthetic data · July 2026</div>
    ${accentRule(122, 650)}`,
  elements: [
    { id: 'm_s1_title', type: 'text', role: 'title', px: { x: 108, y: 314, w: 1020, h: 210 }, isTextual: true,
      content: '# DemoCo — Q2 2026 Business Review' },
    { id: 'm_s1_sub', type: 'text', role: 'subtitle', px: { x: 112, y: 550, w: 780, h: 66 }, isTextual: true,
      content: 'Product demonstration · Synthetic data · July 2026' },
    { id: 'm_s1_orb', type: 'image', role: null, px: { x: 1150, y: 270, w: 340, h: 340 }, isTextual: false,
      content: null, description: 'Decorative glow orb' },
  ],
};

// ---------------------------------------------------------------- slide 2 — state of the business
const s2 = {
  slideId: 'g_mock_slide2',
  html: `
    ${wordmark(30, 1452, 44)}
    <div class="abs" style="left:100px;top:64px;width:900px;height:80px;font-size:54px;font-weight:800;color:${INK};letter-spacing:-1px;">State of the Business</div>
    ${accentRule(102, 152)}
    <ul class="abs" style="left:132px;top:216px;width:750px;height:430px;font-size:32px;line-height:1.95;color:#c7cddc;list-style:disc;">
      <li>ARR peaked at <b style="color:${INK}">$8.4M</b> in January</li>
      <li>Enterprise churn stabilized at <b style="color:${INK}">14%/mo</b></li>
      <li>CAC payback stretched to <b style="color:${INK}">19 months</b></li>
      <li><b style="color:${INK}">34 FTEs</b> across GTM and engineering</li>
    </ul>
    <div class="abs" style="left:960px;top:210px;width:540px;height:430px;border-radius:20px;background:linear-gradient(160deg,#11131f 0%,#0d1020 100%);border:1px solid #1e2438;box-shadow:0 20px 60px #00000066;">
      <div style="padding:38px 42px;">
        <div style="font-size:23px;color:${MUTE};letter-spacing:.4px;text-transform:uppercase;">Net new ARR · Q2</div>
        <div style="font-size:74px;font-weight:800;color:#f87171;margin-top:14px;letter-spacing:-2px;">−$2.4M</div>
        <div style="height:1px;background:#1e2438;margin:30px 0;"></div>
        <div style="font-size:23px;color:${MUTE};letter-spacing:.4px;text-transform:uppercase;">Logo retention</div>
        <div style="font-size:74px;font-weight:800;color:#fbbf24;margin-top:14px;letter-spacing:-2px;">71%</div>
      </div>
    </div>
    ${disclaimer()}`,
  elements: [
    { id: 'm_s2_title', type: 'text', role: 'title', px: { x: 92, y: 56, w: 920, h: 96 }, isTextual: true,
      content: '## State of the Business' },
    { id: 'm_s2_body', type: 'text', role: 'body', px: { x: 98, y: 206, w: 800, h: 446 }, isTextual: true,
      content: '- ARR peaked at **$8.4M** in January\n- Enterprise churn stabilized at **14%/mo**\n- CAC payback stretched to **19 months**\n- **34 FTEs** across GTM and engineering' },
    { id: 'm_s2_card', type: 'image', role: null, px: { x: 960, y: 210, w: 540, h: 430 }, isTextual: false,
      content: null, description: 'KPI stat card',
      extraction: '**Q2 KPI card:** Net new ARR −$2.4M; logo retention 71%.' },
    { id: 'm_s2_disc', type: 'text', role: null, px: { x: 94, y: 828, w: 470, h: 52 }, isTextual: true,
      content: 'Fictional company · Synthetic data' },
  ],
};

// ---------------------------------------------------------------- slide 3 — ARR trajectory (wand moment)
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
const arr = [8.4, 7.9, 7.1, 6.2, 5.4, 4.7];
const X0 = 150, XSTEP = 204, Y0 = 560, YSCALE = 46; // chart-local px
const pt = (i) => [X0 + i * XSTEP + 60, Y0 - arr[i] * YSCALE];
const line = months.map((_, i) => pt(i).join(',')).join(' ');
const chartSvg = `
  <svg width="1320" height="620" viewBox="0 0 1320 620">
    <defs>
      <linearGradient id="fall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#f87171" stop-opacity=".34"/>
        <stop offset="100%" stop-color="#f87171" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="stroke" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#fbbf24"/><stop offset="100%" stop-color="#f87171"/>
      </linearGradient>
    </defs>
    <rect width="1320" height="620" rx="18" fill="#11131f" stroke="#1e2438"/>
    ${[2, 4, 6, 8].map((v) => { const y = Y0 - v * YSCALE; return `<line x1="100" y1="${y}" x2="1250" y2="${y}" stroke="#1b2135"/><text x="82" y="${y + 8}" font-size="22" fill="#5b6378" text-anchor="end" font-family="${font}">$${v}M</text>`; }).join('')}
    <polygon points="${line} ${pt(5)[0]},${Y0} ${pt(0)[0]},${Y0}" fill="url(#fall)"/>
    <polyline points="${line}" fill="none" stroke="url(#stroke)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 0 10px #f8717188)"/>
    ${months.map((m, i) => { const [x, y] = pt(i); return `
      <circle cx="${x}" cy="${y}" r="11" fill="#0a0a12" stroke="${i === 0 ? '#fbbf24' : '#f87171'}" stroke-width="5"/>
      <text x="${x}" y="${y - 26}" font-size="27" font-weight="700" fill="${i === 0 ? '#fbbf24' : '#f87171'}" text-anchor="middle" font-family="${font}">${arr[i]}</text>
      <text x="${x}" y="600" font-size="25" fill="#5b6378" text-anchor="middle" font-family="${font}">${m}</text>`; }).join('')}
    <text x="1245" y="64" font-size="25" font-weight="600" fill="#f87171" text-anchor="end" font-family="${font}">▼ 44% from peak</text>
  </svg>`;
const s3 = {
  slideId: 'g_mock_slide3',
  html: `
    ${wordmark(30, 1452, 44)}
    <div class="abs" style="left:100px;top:58px;width:1000px;height:80px;font-size:54px;font-weight:800;color:${INK};letter-spacing:-1px;">ARR Trajectory</div>
    ${accentRule(102, 146)}
    <div class="abs" style="left:140px;top:192px;width:1320px;height:620px;">${chartSvg}</div>
    ${disclaimer()}`,
  elements: [
    { id: 'm_s3_title', type: 'text', role: 'title', px: { x: 92, y: 50, w: 1020, h: 96 }, isTextual: true,
      content: '## ARR Trajectory' },
    { id: 'm_s3_chart', type: 'chart', role: null, px: { x: 140, y: 192, w: 1320, h: 620 }, isTextual: false,
      content: null, description: 'ARR by month line chart',
      extraction: '**ARR by month ($M)**\n\n| Month | ARR | MoM |\n| --- | --- | --- |\n| Jan | 8.4 | — |\n| Feb | 7.9 | −6% |\n| Mar | 7.1 | −10% |\n| Apr | 6.2 | −13% |\n| May | 5.4 | −13% |\n| Jun | 4.7 | −13% |\n\nARR is down **40% from the January peak**, and the decline accelerated to ~13%/mo through Q2.' },
    { id: 'm_s3_disc', type: 'text', role: null, px: { x: 94, y: 828, w: 470, h: 52 }, isTextual: true,
      content: 'Fictional company · Synthetic data' },
  ],
};

// ---------------------------------------------------------------- slide 4 — recovery plan
const planCards = [
  { x: 90, t: 'Enterprise pivot', s: 'land 25 logos ≥ $50k' },
  { x: 500, t: 'Usage pricing', s: 'decouple seats from value' },
  { x: 910, t: 'Win-back program', s: 'target 120 churned logos' },
];
const diagSvg = `
  <svg width="1320" height="620" viewBox="0 0 1320 620">
    <rect width="1320" height="620" rx="18" fill="#11131f" stroke="#1e2438"/>
    <defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#3b82f6"/></marker></defs>
    ${planCards.map((b) => `
      <rect x="${b.x}" y="200" width="330" height="170" rx="18" fill="#0d1020" stroke="${BLUE}" stroke-width="2.5"/>
      <rect x="${b.x}" y="200" width="330" height="10" rx="5" fill="${BLUE}"/>
      <text x="${b.x + 165}" y="280" font-size="31" font-weight="700" fill="${INK}" text-anchor="middle" font-family="${font}">${b.t}</text>
      <text x="${b.x + 165}" y="326" font-size="23" fill="${MUTE}" text-anchor="middle" font-family="${font}">${b.s}</text>`).join('')}
    ${[420, 830].map((x) => `<line x1="${x}" y1="285" x2="${x + 74}" y2="285" stroke="${BLUE}" stroke-width="5" marker-end="url(#ar)"/>`).join('')}
    <rect x="440" y="450" width="440" height="100" rx="16" fill="${BLUE}" style="filter:drop-shadow(0 0 24px ${BLUE}88)"/>
    <text x="660" y="496" font-size="29" font-weight="800" fill="#fff" text-anchor="middle" font-family="${font}">ARR +$2M by Q4</text>
    <text x="660" y="530" font-size="21" fill="#dbeafe" text-anchor="middle" font-family="${font}">return to growth</text>
    ${[255, 665, 1075].map((x) => `<line x1="${x}" y1="372" x2="660" y2="448" stroke="#2b3350" stroke-width="3" stroke-dasharray="7 7"/>`).join('')}
  </svg>`;
const s4 = {
  slideId: 'g_mock_slide4',
  html: `
    ${wordmark(30, 1452, 44)}
    <div class="abs" style="left:100px;top:58px;width:1000px;height:80px;font-size:54px;font-weight:800;color:${INK};letter-spacing:-1px;">Recovery Plan</div>
    ${accentRule(102, 146)}
    <div class="abs" style="left:140px;top:192px;width:1320px;height:620px;">${diagSvg}</div>
    ${disclaimer()}`,
  elements: [
    { id: 'm_s4_title', type: 'text', role: 'title', px: { x: 92, y: 50, w: 1020, h: 96 }, isTextual: true,
      content: '## Recovery Plan' },
    { id: 'm_s4_diag', type: 'image', role: null, px: { x: 140, y: 192, w: 1320, h: 620 }, isTextual: false,
      content: null, description: 'Recovery plan flow diagram',
      extraction: '**Recovery plan:** Enterprise pivot (land 25 logos ≥ $50k) → usage-based pricing (decouple seats from value) → win-back program (target 120 churned logos), converging on **ARR +$2M by Q4** and a return to growth.' },
    { id: 'm_s4_disc', type: 'text', role: null, px: { x: 94, y: 828, w: 470, h: 52 }, isTextual: true,
      content: 'Fictional company · Synthetic data' },
  ],
};

// ---------------------------------------------------------------- emit
const slidesDef = [s1, s2, s3, s4];

const presentation = {
  presentationId: 'mock-democo-deck',
  title: 'DemoCo — Q2 2026 Business Review',
  pageSize: { width: PX_W * EMU, height: PX_H * EMU },
  slides: slidesDef.map((s, i) => ({
    slideId: s.slideId,
    index: i,
    elements: s.elements.map((el) => ({
      elementId: el.id,
      type: el.type,
      role: el.role,
      boundingBox: emu(el.px),
      isTextual: el.isTextual,
      extractedContent: el.content,
      extractionSource: el.isTextual ? 'api-text' : null,
      description: el.description ?? null,
    })),
  })),
};

const extractions = {};
for (const s of slidesDef)
  for (const el of s.elements)
    if (el.extraction) extractions[el.id] = el.extraction;

mkdirSync(join(root, 'public/mock'), { recursive: true });
writeFileSync(join(root, 'lib/mockDeck.json'), JSON.stringify({ presentation, extractions }, null, 2));
console.log('wrote lib/mockDeck.json');

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
const page = await browser.newPage({ viewport: { width: PX_W, height: PX_H } });
for (let i = 0; i < slidesDef.length; i++) {
  const s = slidesDef[i];
  await page.setContent(`<style>${baseCss}</style>${s.html}`);
  await page.screenshot({ path: join(root, `public/mock/slide-${i + 1}.png`) });
  console.log(`wrote public/mock/slide-${i + 1}.png`);
}
await browser.close();
