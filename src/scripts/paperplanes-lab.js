// The paper-plane OG loop tool, mounted on /paperplanes.
// mountLab() builds the controls inside the page markup and returns a teardown function.
export function mountLab(root) {
const TAU = Math.PI * 2;
const FONT = 'Verdana, "DejaVu Sans", "Bitstream Vera Sans", Geneva, sans-serif';
const THEMES = {
  light: { page:"#ffffff", heading:"#222222", body:"#444444" },
  dark:  { page:"#01242e", heading:"#eeeeee", body:"#dddddd" }
};
const SIZES = { "1200x630":[1200,630], "1280x720":[1280,720] };
const LINES = [
  { id:"craft-well", text:"I build products, and care a lot about the craft of doing it well." },
  { id:"craft-short", text:"I build products, and I care about the craft." },
  { id:"engineer",   text:"I'm a software engineer." },
  { id:"turned",     text:"Software engineer turned product builder. I care about craft." },
  { id:"feels",      text:"I build software that feels good to use." },
  { id:"details",    text:"I build products, and I sweat the details." },
  { id:"wonderful",  text:"I build products. I care about craft: the details that make software feel wonderful." }
];
const reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
function initialTheme(){ return document.documentElement.classList.contains("dark") ? "dark" : "light"; }
const G = { theme: initialTheme(), size:"1200x630", loop:8, playing:!reduced, t: reduced ? 0.7 : 0 };
const P = {
  line:"craft-well", custom:"", lineSize:30,
  // defaults = the settings behind the live og.mp4 on nicholascharriere.com
  design:"outline", tone:"paper", count:4, size:21, depth:true,
  style:"swoop", dir:"both", speed:1, variety:0.35, surge:0, loops:"lead", loopSize:0.35, loopAt:0.7, clear:true, seed:1,
  trail:"dashed", trailLen:1, trailAlpha:0.34,
  shadow:true, shStrength:1, shSoft:2.5, shHeight:11, shLight:"tl"
};
const DEFAULT_P = JSON.parse(JSON.stringify(P)), DEFAULT_G = { size:G.size, loop:G.loop };
// keep the viewer's tuning across republishes: this browser's saved copy, then the live-update snapshot
const STORE = "paperplanes:settings:v1";
const ENUMS = { design:["dart","glider","folded","outline"], tone:["paper","ink","blue"], style:["level","glide","swoop"], dir:["right","left","both"], loops:["none","lead","all"], trail:["none","dashed","dotted","solid"], shLight:["tl","t","tr"] };
function restore(src){
  if (!src || typeof src !== "object") return;
  if (src.P) for (const k of Object.keys(P)){
    if (!(k in src.P)) continue; const v = src.P[k];
    if (typeof v !== typeof P[k]) continue;
    if (ENUMS[k] && !ENUMS[k].includes(v)) continue;
    if (k === "line" && v !== "custom" && !LINES.some(l => l.id === v)) continue;
    P[k] = v;
  }
  if (src.G){ if (SIZES[src.G.size]) G.size = src.G.size; if (typeof src.G.loop === "number") G.loop = src.G.loop; }
}
function snapshot(){ return { P:{ ...P }, G:{ size:G.size, loop:G.loop } }; }
try { restore(JSON.parse(localStorage.getItem(STORE) || "null")); } catch (e) {}
let saveTimer = 0;
function save(){ clearTimeout(saveTimer); saveTimer = setTimeout(() => { try { localStorage.setItem(STORE, JSON.stringify(snapshot())); } catch (e) {} }, 250); }
const dims = () => SIZES[G.size];
const lineText = () => P.line === "custom" ? (P.custom.trim() || "I build products.") : LINES.find(l => l.id === P.line).text;

/* ---------- helpers ---------- */
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function rgba(h,a){ const n = parseInt(h.slice(1),16); return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`; }
function wrapLines(ctx, text, maxW){
  const words = text.split(/\s+/), lines = []; let line = "";
  for (const w of words){ const test = line ? line + " " + w : w; if (ctx.measureText(test).width > maxW && line){ lines.push(line); line = w; } else line = test; }
  if (line) lines.push(line); return lines;
}
function balancedLines(ctx, text, maxW){
  const n = wrapLines(ctx, text, maxW).length; if (n < 2) return wrapLines(ctx, text, maxW);
  let lo = maxW*0.4, hi = maxW;
  for (let i=0;i<14;i++){ const mid = (lo+hi)/2; if (wrapLines(ctx, text, mid).length > n) lo = mid; else hi = mid; }
  return wrapLines(ctx, text, hi);
}
function makeCanvas(w,h){ const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }

/* ---------- caption typography ---------- */
const textCache = new Map();
function textLayer(W, H, theme, text){
  const key = [W,H,theme,P.lineSize,text].join("|");
  if (textCache.has(key)) return textCache.get(key);
  if (textCache.size > 30) textCache.clear();
  const c = makeCanvas(W,H), x = c.getContext("2d"), th = THEMES[theme], k = H/630, L = Math.round(W*0.08);
  const nameSize = 58*k, ls = P.lineSize*k, lh = ls*1.55;
  x.font = `${Math.round(ls)}px ${FONT}`;
  const lines = balancedLines(x, text, 0.60*W);
  const cap = nameSize*0.73, gap = Math.max(54*k, ls*2.05);
  const blockH = cap + gap + (lines.length-1)*lh + ls*0.3, top = 0.86*H - blockH;
  x.textBaseline = "alphabetic";
  x.fillStyle = th.heading; x.font = `bold ${Math.round(nameSize)}px ${FONT}`;
  x.fillText("Nicholas Charriere", L, top + cap);
  let w = x.measureText("Nicholas Charriere").width;
  x.fillStyle = th.body; x.font = `${Math.round(ls)}px ${FONT}`;
  lines.forEach((l, i) => { x.fillText(l, L, top + cap + gap + i*lh); w = Math.max(w, x.measureText(l).width); });
  const out = { canvas:c, box:{ x0:L, x1:L+w, y0: top - 8*k, y1: top + blockH + 8*k }, lines:lines.length };
  textCache.set(key, out); return out;
}

/* ---------- plane designs (unit space: nose at +x = 1, about 2 units long) ---------- */
function poly(pts){ const p = new Path2D(); p.moveTo(pts[0][0],pts[0][1]); for (let i=1;i<pts.length;i++) p.lineTo(pts[i][0],pts[i][1]); p.closePath(); return p; }
function seg(a,b){ const p = new Path2D(); p.moveTo(a[0],a[1]); p.lineTo(b[0],b[1]); return p; }
/** Plane designs; the Path2D fields (silP, facetsP, creaseP) are added just below. @type {Record<string, any>} */
const DESIGNS = {
  dart: { label:"Dart",
    facets:[["mid",[[1,0],[-0.8,-0.2],[-0.52,0.06]]], ["dark",[[1,0],[-0.52,0.06],[-0.84,0.44]]], ["light",[[1,0],[-1,-0.52],[-0.52,0.06]]]],
    edges:[1,2], sil:[[1,0],[-1,-0.52],[-0.52,0.06],[-0.84,0.44]] },
  glider: { label:"Glider",
    facets:[["mid",[[1,0],[-0.78,-0.62],[-0.6,0]]], ["dark",[[1,0],[-0.6,0],[-0.66,0.12]]], ["light",[[1,0],[-0.62,0.06],[-0.8,0.86]]]],
    edges:[0,2], crease:[[1,0],[-0.6,0]], sil:[[1,0],[-0.78,-0.62],[-0.6,0],[-0.8,0.86]] },
  folded: { label:"Origami",
    facets:[["dark",[[1,0],[-0.55,0.05],[-0.86,0.42]]], ["light",[[1,0],[-1,-0.5],[-0.7,-0.16]]], ["mid",[[1,0],[-0.7,-0.16],[-0.55,0.05]]], ["mid",[[-1,-0.5],[-0.93,-0.68],[-0.8,-0.42]]]],
    edges:[0,1,2,3], sil:[[1,0],[-0.8,-0.42],[-0.93,-0.68],[-1,-0.5],[-0.7,-0.16],[-0.55,0.05],[-0.86,0.42]] },
  outline: { label:"Line", outline:true, crease:[[1,0],[-0.52,0.06]], sil:[[1,0],[-1,-0.52],[-0.52,0.06],[-0.84,0.44]] }
};
for (const d of Object.values(DESIGNS)){
  d.silP = poly(d.sil);
  if (d.facets) d.facetsP = d.facets.map(([tone, pts]) => [tone, poly(pts)]);
  if (d.crease) d.creaseP = seg(d.crease[0], d.crease[1]);
}
const TONES = {
  paper: { label:"Paper",
    light:{ light:"#ffffff", mid:"#e5eaf0", dark:"#c6cfda", stroke:"rgba(34,34,34,0.62)", line:"#444444", trail:"#444444" },
    dark: { light:"#f2f7f8", mid:"#bccfd5", dark:"#7f9ba4", stroke:"rgba(0,12,18,0.45)", line:"#dddddd", trail:"#dddddd" } },
  ink: { label:"Ink",
    light:{ light:"#5c5c5c", mid:"#3c3c3c", dark:"#222222", stroke:null, line:"#222222", trail:"#444444" },
    dark: { light:"#eeeeee", mid:"#c9d3d6", dark:"#9fb0b5", stroke:null, line:"#eeeeee", trail:"#dddddd" } },
  blue: { label:"Blue",
    light:{ light:"#eaf1fd", mid:"#b9cff3", dark:"#3273dc", stroke:"rgba(50,115,220,0.85)", line:"#3273dc", trail:"#3273dc" },
    dark: { light:"#dff0f7", mid:"#8cc2dd", dark:"#4a87a3", stroke:"rgba(0,20,30,0.35)", line:"#8cc2dd", trail:"#8cc2dd" } }
};
const SHADOW_COLOR = { light:"rgba(25,35,50,0.22)", dark:"rgba(0,0,0,0.55)" };
function drawPlane(ctx, theme, x, y, ang, s, alpha, flip, design, tone){
  const D = DESIGNS[design || P.design], C = TONES[tone || P.tone][theme];
  ctx.save(); ctx.translate(x,y); ctx.rotate(ang); ctx.scale(s, flip ? -s : s); ctx.globalAlpha = alpha;
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  if (D.outline){
    ctx.fillStyle = THEMES[theme].page; ctx.fill(D.silP);
    ctx.strokeStyle = C.line; ctx.lineWidth = 1.5/s; ctx.stroke(D.silP); ctx.stroke(D.creaseP);
  } else {
    for (const [t, p] of D.facetsP){ ctx.fillStyle = C[t]; ctx.fill(p); }
    if (C.stroke){
      ctx.strokeStyle = C.stroke; ctx.lineWidth = 1.15/s;
      for (const i of D.edges) ctx.stroke(D.facetsP[i][1]);
      if (D.creaseP) ctx.stroke(D.creaseP);
    }
  }
  ctx.restore();
}
function drawPlaneShadow(ctx, theme, x, y, ang, s, alpha, blur, flip, design){
  const off = 20000;  // draw off-canvas so only the blurred shadow lands here
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.shadowColor = SHADOW_COLOR[theme]; ctx.shadowBlur = blur; ctx.shadowOffsetX = off; ctx.shadowOffsetY = 0;
  ctx.translate(x - off, y); ctx.rotate(ang); ctx.scale(s, flip ? -s : s);
  ctx.fillStyle = "#000"; ctx.fill(DESIGNS[design || P.design].silP); ctx.restore();
}
const LIGHT_DIR = { tl:[0.45,0.89], t:[0,1], tr:[-0.45,0.89] };

/* ---------- flight ---------- */
const fleetCache = new Map();
function styleExtent(H){ return P.style === "glide" ? 0.115*H : P.style === "swoop" ? 0.09*H : 0.026*H; }
function fleet(W, H, T){
  const key = [P.loopAt, P.count, P.seed, P.depth, P.clear, P.style, P.dir, P.variety, P.loops, W, H, T.box.y0|0, T.box.y1|0].join("|");
  if (fleetCache.has(key)) return fleetCache.get(key);
  if (fleetCache.size > 40) fleetCache.clear();
  const r = mulberry32(P.seed*7919 + 13), arr = [], n = P.count;
  for (let i=0;i<n;i++){
    const d = (P.depth && n > 1) ? 0.55 + 0.45*(i/(n-1)) : 1;
    // draw every random number in a fixed order so toggling one setting doesn't reshuffle the rest
    const pl = { i, d, amp:H*(0.010 + 0.016*r()), m:1 + Math.floor(r()*2), bob:r(), rr:r(),
      phase:(i/n + r()*0.2) % 1, rv:r(), ph2:r(), nP:1 + Math.floor(r()*2), loopAt:0.25 + 0.45*r(), dr:r() };
    pl.dirSign = P.dir === "right" ? 1 : P.dir === "left" ? -1 : ((i + P.seed) % 2 ? -1 : 1);
    arr.push(pl);
  }
  arr.sort((a,b) => a.d - b.d);
  const lead = arr[arr.length-1];
  arr.forEach(pl => { pl.loops = P.loops === "all" || (P.loops === "lead" && pl === lead); if (pl === lead && P.loops === "lead") pl.loopAt = P.loopAt; });
  // vertical slots: the sky above the caption (and below it, if there's room) when keeping clear
  const b = T.box, bands = [];
  if (P.clear){
    if (b.y0 - 0.03*H > 0.12*H) bands.push([0.06*H, b.y0 - 0.03*H]);
    if (0.95*H - (b.y1 + 0.03*H) > 0.06*H) bands.push([b.y1 + 0.03*H, 0.95*H]);
  }
  if (!bands.length) bands.push([0.08*H, 0.92*H]);
  const ext = styleExtent(H);
  arr.forEach((pl, i) => {
    const bd = pl.loops && P.loops === "lead" ? bands[bands.length-1] : bands[(i + (P.seed % 2)) % bands.length];
    // a looping plane needs headroom above it for the loop
    const lo = bd[0] + ext + (pl.loops ? 0.17*H : 0), hi = bd[1] - ext;
    const f = pl.loops && P.loops === "lead" ? 0.85 : 0.1 + 0.8*pl.rr;
    pl.y = hi > lo ? lo + (hi - lo)*f : (bd[0] + bd[1])/2;
  });
  fleetCache.set(key, arr); return arr;
}
// returns [x, y, distance along path]
// Seamless loops need a whole number of crossings per loop. For in-between speeds a plane flies
// a longer route (partly off screen), so it is back at its start on the last frame.
const BASE_LOOP = 8;  // 1x = one crossing every 8 s
function lane(pl){
  const want = Math.max(P.speed, BASE_LOOP/G.loop)*(1 + P.variety*1.1*pl.rv);
  const nf = want*G.loop/BASE_LOOP, n = Math.max(1, Math.floor(nf + 1e-6));
  return [n, nf/n];
}
function pos(pl, t, W, H){
  const [nC, rr] = lane(pl), k = H/630, pad = 70*k, track = (W + 2*pad)*rr;
  const ul = (((t*nC + pl.phase) % 1) + 1) % 1;
  // surge: uneven speed within a pass; in "glide" it is tied to the dives
  const n = P.style === "glide" ? pl.nP : 2, sg = P.surge*0.45;
  const ue = ul + sg/(TAU*n)*Math.sin(TAU*(ul*n + pl.ph2));
  let x = -pad + ue*track, y;
  if (P.style === "glide") y = pl.y + 0.16*H*(ue - 0.5) + 0.035*H*Math.sin(TAU*(ue*n + pl.ph2));
  else if (P.style === "swoop") y = pl.y + 0.09*H*Math.sin(TAU*(ue + pl.ph2));
  else y = pl.y + pl.amp*Math.sin(TAU*(t*pl.m + pl.bob));
  if (pl.dirSign < 0) x = W - x;
  if (pl.loops && P.loops !== "none"){
    const w = (0.12 + 0.16*P.loopSize)/rr, a = (pl.loopAt*W + pad)/track;
    if (ue > a && ue < a + w){
      const q = (ue - a)/w, qe = q - Math.sin(TAU*q)/TAU, R = 1.45*track*w/TAU;
      x += pl.dirSign*R*Math.sin(TAU*qe); y -= R*(1 - Math.cos(TAU*qe));
    }
  }
  return [x, y, ue*track];
}
function drawTrail(ctx, s, t, W, H, theme){
  const k = H/630, N = Math.round(clampN(30*P.trailLen, 8, 90)), span = 0.1*P.trailLen/lane(s.pl)[0], pts = [[s.x, s.y]];
  for (let j=1;j<=N;j++){ const q = pos(s.pl, t - j*span/N, W, H), p = pts[pts.length-1]; if (Math.abs(q[0]-p[0]) > W/2) break; pts.push([q[0],q[1]]); }
  const cum = [0]; for (let j=1;j<pts.length;j++) cum.push(cum[j-1] + Math.hypot(pts[j][0]-pts[j-1][0], pts[j][1]-pts[j-1][1]));
  const col = TONES[P.tone][theme].trail;
  ctx.save(); ctx.lineCap = "round";
  if (P.trail === "dashed"){ ctx.setLineDash([6*k, 7*k]); ctx.lineWidth = 1.6*k*s.scale; }
  else if (P.trail === "dotted"){ ctx.setLineDash([0.01, 7*k]); ctx.lineWidth = 2.6*k*s.scale; }
  else { ctx.setLineDash([]); ctx.lineWidth = 1.3*k*s.scale; }
  for (let j=0;j<pts.length-1;j++){
    ctx.strokeStyle = rgba(col, P.trailAlpha*(1 - j/N)*s.alpha);
    ctx.lineDashOffset = s.dist - cum[j+1];   // keeps dashes fixed in space
    ctx.beginPath(); ctx.moveTo(pts[j+1][0], pts[j+1][1]); ctx.lineTo(pts[j][0], pts[j][1]); ctx.stroke();
  }
  ctx.restore();
}
const clampN = (x,a,b) => Math.min(b, Math.max(a, x));
function shadowOf(ctx, theme, x, y, ang, s, alpha, flip, k, scale){
  if (!P.shadow || P.shStrength <= 0) return;
  const [dx, dy] = LIGHT_DIR[P.shLight], h = P.shHeight*k*scale;
  drawPlaneShadow(ctx, theme, x + dx*h, y + dy*h, ang, s, Math.min(1, 0.9*P.shStrength)*alpha, P.shSoft*k*scale, flip);
}
function drawFrame(ctx, W, H, t, theme){
  const k = H/630, T = textLayer(W, H, theme, lineText()), dt = 0.0015;
  ctx.fillStyle = THEMES[theme].page; ctx.fillRect(0,0,W,H);
  ctx.drawImage(T.canvas, 0, 0);
  const st = fleet(W, H, T).map(pl => {
    const [x,y,dist] = pos(pl,t,W,H), b = pos(pl,t-dt,W,H); let ang;
    if (Math.abs(x-b[0]) > W/2){ const f = pos(pl,t+dt,W,H); ang = Math.atan2(f[1]-y, f[0]-x); } else ang = Math.atan2(y-b[1], x-b[0]);
    return { pl, x, y, dist, ang, scale:pl.d, alpha:0.55 + 0.45*pl.d, flip:pl.dirSign < 0 };
  });
  for (const s of st) shadowOf(ctx, theme, s.x, s.y, s.ang, P.size*k*s.scale, s.alpha, s.flip, k, s.scale);
  if (P.trail !== "none") for (const s of st) drawTrail(ctx, s, t, W, H, theme);
  for (const s of st) drawPlane(ctx, theme, s.x, s.y, s.ang, P.size*k*s.scale, s.alpha, s.flip);
}
function drawCloseup(ctx, W, H, t, theme){
  const k = H/300;
  ctx.fillStyle = THEMES[theme].page; ctx.fillRect(0,0,W,H);
  const y = H*0.45 + 10*k*Math.sin(TAU*t*2), ang = -0.1 + 0.08*Math.cos(TAU*t*2), s = 70*k;
  shadowOf(ctx, theme, W/2, y, ang, s, 1, false, k*2.2, 1);
  drawPlane(ctx, theme, W/2, y, ang, s, 1, false);
}

/* ---------- UI ---------- */
const canvas = document.getElementById("stage"), ctx = canvas.getContext("2d");
const mini = document.getElementById("mini"), miniCtx = mini.getContext("2d"), meter = document.getElementById("meter");
const closeup = document.getElementById("closeup"), closeCtx = closeup.getContext("2d");
function el(tag, attrs, ...kids){ const e = document.createElement(tag); if (attrs) for (const [a,v] of Object.entries(attrs)){ if (a === "class") e.className = v; else if (a === "text") e.textContent = v; else e.setAttribute(a, v); } for (const kd of kids) if (kd) e.append(kd); return e; }

const pct = v => `${Math.round(v*100)}%`;
const PANELS = [
  { title:"plane", fields:[
    { k:"design", type:"designs" },
    { k:"tone", label:"color", type:"seg", options:[["paper","Paper"],["ink","Ink"],["blue","Blue"]] },
    { k:"count", label:"planes", type:"range", min:1, max:9, step:1 },
    { k:"size", label:"size", type:"range", min:5, max:30, step:1, fmt:v => `${v*2} px` },
    { k:"depth", label:"Some planes farther away", type:"check" }
  ]},
  { title:"flight", fields:[
    { k:"style", label:"path", type:"seg", options:[["level","Level"],["glide","Glide"],["swoop","Swoop"]] },
    { k:"dir", label:"direction", type:"seg", options:[["right","→"],["left","←"],["both","Both"]] },
    { k:"speed", label:"speed", type:"range", min:0.5, max:3, step:0.05, fmt:v => `${v.toFixed(2)}×`, note:speedNote },
    { k:"variety", label:"speed variety", type:"range", min:0, max:1, step:0.05, fmt:pct },
    { k:"surge", label:"surge within a pass", type:"range", min:0, max:1, step:0.05, fmt:pct },
    { k:"loops", label:"loop-the-loop", type:"seg", options:[["none","None"],["lead","Lead plane"],["all","Every plane"]] },
    { k:"loopAt", label:"loop position (lead plane)", type:"range", min:0.3, max:0.8, step:0.01, fmt:pct, when:() => P.loops === "lead" },
    { k:"loopSize", label:"loop size", type:"range", min:0, max:1, step:0.05, fmt:pct, when:() => P.loops !== "none" },
    { k:"clear", label:"Keep clear of the text", type:"check" },
    { type:"button", label:"Shuffle flight paths", act:() => { P.seed++; } }
  ]},
  { title:"trail", fields:[
    { k:"trail", label:"style", type:"seg", options:[["none","None"],["dashed","Dashed"],["dotted","Dotted"],["solid","Solid"]] },
    { k:"trailLen", label:"length", type:"range", min:0.3, max:3, step:0.1, fmt:v => `${v.toFixed(1)}×`, when:() => P.trail !== "none" },
    { k:"trailAlpha", label:"strength", type:"range", min:0.1, max:0.8, step:0.02, fmt:pct, when:() => P.trail !== "none" }
  ]},
  { title:"shadow", fields:[
    { k:"shadow", label:"Shadows", type:"check" },
    { k:"shStrength", label:"strength", type:"range", min:0, max:1.6, step:0.05, fmt:pct, when:() => P.shadow },
    { k:"shSoft", label:"softness", type:"range", min:0, max:12, step:0.5, fmt:v => `${v} px`, when:() => P.shadow },
    { k:"shHeight", label:"height above the page", type:"range", min:0, max:40, step:1, fmt:v => `${v} px`, when:() => P.shadow },
    { k:"shLight", label:"light from", type:"seg", options:[["tl","Top left"],["t","Top"],["tr","Top right"]], when:() => P.shadow }
  ]}
];
const panelsBox = document.getElementById("panels"), gated = [], swatches = [], notes = [], bindings = [];
for (const pn of PANELS){
  const fs = el("fieldset", { class:"panel" }, el("legend", { text:pn.title }));
  for (const f of pn.fields){
    const id = `p-${f.k || "shuffle"}`; let node, inputs = [];
    if (f.type === "designs"){
      node = el("div", { class:"designs", role:"radiogroup", "aria-label":"Plane design" });
      for (const [key, D] of Object.entries(DESIGNS)){
        const rid = `${id}-${key}`, r = el("input", { type:"radio", name:id, id:rid, value:key }); if (P.design === key) r.checked = true;
        r.addEventListener("change", () => { if (r.checked){ P.design = key; changed(); } });
        const cv = el("canvas", { width:220, height:96, "aria-hidden":"true" });
        node.append(el("label", { class:"design", for:rid }, cv, el("span", { class:"nm" }, r, document.createTextNode(D.label))));
        swatches.push({ key, cv });
      }
      { const box = node; bindings.push(() => box.querySelectorAll("input").forEach(r => { r.checked = r.value === P.design; })); }
    } else if (f.type === "range"){
      const inp = el("input", { type:"range", id, min:f.min, max:f.max, step:f.step }); inp.value = P[f.k];
      const fmt = f.fmt || (v => v), out = el("output", { for:id, text:String(fmt(P[f.k])) });
      inp.addEventListener("input", () => { P[f.k] = +inp.value; out.textContent = fmt(P[f.k]); changed(); });
      const note = f.note ? el("p", { class:"sub" }) : null; if (note) notes.push([note, f.note]);
      bindings.push(() => { inp.value = P[f.k]; out.textContent = fmt(P[f.k]); });
      node = el("div", { class:"ctl" }, el("label", { class:"lbl", for:id, text:f.label }), el("div", { class:"row" }, inp, out), note); inputs = [inp];
    } else if (f.type === "seg"){
      const seg = el("div", { class:"seg", role:"radiogroup", "aria-labelledby":`${id}-lbl` });
      for (const [v, lab] of f.options){
        const rid = `${id}-${v}`, r = el("input", { type:"radio", name:id, id:rid, value:v }); if (P[f.k] === v) r.checked = true;
        r.addEventListener("change", () => { if (r.checked){ P[f.k] = v; changed(); } });
        seg.append(r, el("label", { for:rid, text:lab })); inputs.push(r);
      }
      { const rs = inputs.slice(); bindings.push(() => rs.forEach(r => { r.checked = r.value === P[f.k]; })); }
      node = el("div", { class:"ctl" }, el("span", { class:"lbl", id:`${id}-lbl`, text:f.label }), seg);
    } else if (f.type === "check"){
      const cb = el("input", { type:"checkbox", id }); cb.checked = !!P[f.k];
      cb.addEventListener("change", () => { P[f.k] = cb.checked; changed(); });
      bindings.push(() => { cb.checked = !!P[f.k]; });
      node = el("label", { class:"check", for:id }, cb, document.createTextNode(f.label)); inputs = [cb];
    } else {
      const b = el("button", { type:"button", id, text:f.label });
      b.addEventListener("click", () => { f.act(); changed(); });
      node = el("div", { class:"btnrow" }, b);
    }
    if (f.when) gated.push({ node, inputs, when:f.when });
    fs.append(node);
  }
  panelsBox.append(fs);
}
function syncGated(){ for (const g of gated){ const on = g.when(); g.node.classList.toggle("off", !on); g.inputs.forEach(i => i.disabled = !on); } }
function updateNotes(){ for (const [n, f] of notes) n.textContent = f(); }
function speedNote(){
  const min = BASE_LOOP/G.loop, eff = Math.max(P.speed, min), nf = eff*G.loop/BASE_LOOP, n = Math.max(1, Math.floor(nf + 1e-6)), r = nf/n;
  const fits = []; for (let L = 4; L <= 16; L++){ const q = eff*L/BASE_LOOP; if (q >= 1 - 1e-6 && Math.abs(q - Math.round(q)) < 0.02) fits.push(`${L} s`); }
  let s = P.speed < min - 1e-6 ? `The slowest speed a ${G.loop} s loop allows is ${min.toFixed(2)}×. ` : "";
  if (r > 1.005) s += `Each plane is off screen ${Math.round((1 - 1/r)*100)}% of the loop. ` + (fits.length ? `Loop lengths with no gap at ${eff.toFixed(2)}×: ${fits.join(", ")}.` : `No loop length up to 16 s avoids the gap at this speed.`);
  else s += `${n} ${n === 1 ? "pass" : "passes"} per loop, always in view.`;
  return s;
}
function drawSwatches(){
  for (const sw of swatches){
    const x = sw.cv.getContext("2d"), W = sw.cv.width, H = sw.cv.height;
    x.fillStyle = THEMES[G.theme].page; x.fillRect(0,0,W,H);
    shadowOf(x, G.theme, W/2, H*0.44, -0.12, 44, 1, false, 1.1, 1);
    drawPlane(x, G.theme, W/2, H*0.44, -0.12, 44, 1, false, sw.key, P.tone);
  }
}

// line chooser
const linesBox = document.getElementById("lines"), curLine = document.getElementById("cur-line"), lenOuts = [];
function lineCount(text){ const [W,H] = dims(); return textLayer(W, H, G.theme, text).lines; }
for (const l of LINES){
  const id = `line-${l.id}`, r = el("input", { type:"radio", name:"line", id, value:l.id }); if (P.line === l.id) r.checked = true;
  r.addEventListener("change", () => { if (r.checked){ P.line = l.id; changed(); } });
  const len = el("span", { class:"len" }); lenOuts.push([len, () => l.text]);
  bindings.push(() => { r.checked = P.line === l.id; });
  linesBox.append(el("label", { class:"opt", for:id }, r, el("span", { class:"txt", text:l.text }), len));
}
{
  const r = el("input", { type:"radio", name:"line", id:"line-custom", value:"custom" });
  const txt = el("input", { type:"text", id:"line-custom-text", placeholder:"Write your own line", "aria-label":"Your own line", maxlength:"120" });
  txt.value = P.custom; if (P.line === "custom") r.checked = true;
  bindings.push(() => { txt.value = P.custom; r.checked = P.line === "custom"; });
  const len = el("span", { class:"len" }); lenOuts.push([len, () => txt.value.trim()]);
  r.addEventListener("change", () => { if (r.checked){ P.line = "custom"; changed(); } });
  txt.addEventListener("focus", () => { r.checked = true; P.line = "custom"; changed(); });
  txt.addEventListener("input", () => { P.custom = txt.value; r.checked = true; P.line = "custom"; changed(); });
  linesBox.append(el("label", { class:"opt", for:"line-custom" }, r, txt, len));
  const sizeIn = el("input", { type:"range", id:"p-lineSize", min:22, max:40, step:1 }); sizeIn.value = P.lineSize;
  const sizeOut = el("output", { for:"p-lineSize", text:`${P.lineSize} px` });
  sizeIn.addEventListener("input", () => { P.lineSize = +sizeIn.value; sizeOut.textContent = `${P.lineSize} px`; changed(); });
  bindings.push(() => { sizeIn.value = P.lineSize; sizeOut.textContent = `${P.lineSize} px`; });
  linesBox.append(el("div", { class:"ctl" }, el("label", { class:"lbl", for:"p-lineSize", text:"line size" }), el("div", { class:"row" }, sizeIn, sizeOut)));
}
function updateLines(){
  curLine.textContent = lineText();
  for (const [o, f] of lenOuts){ const s = f(); if (!s){ o.textContent = ""; continue; } const n = lineCount(s); o.textContent = `${n} ${n === 1 ? "line" : "lines"}`; }
}

// bar
const loopIn = document.getElementById("g-loop"), loopOut = document.getElementById("g-loop-out");
function applyCanvasSize(){ const [W,H] = dims(); canvas.width = W; canvas.height = H; mini.height = Math.round(mini.width*H/W); }
function syncBarInputs(){
  document.getElementById(`g-theme-${G.theme}`).checked = true;
  document.getElementById(`g-size-${G.size}`).checked = true;
  loopIn.value = G.loop; loopOut.textContent = `${G.loop} s`;
}
syncBarInputs(); applyCanvasSize();
document.querySelectorAll('input[name="g-theme"]').forEach(r => r.addEventListener("change", () => { if (r.checked){ G.theme = r.value; changed(); } }));
document.querySelectorAll('input[name="g-size"]').forEach(r => r.addEventListener("change", () => { if (r.checked){ G.size = r.value; applyCanvasSize(); changed(); } }));
loopIn.addEventListener("input", () => { G.loop = +loopIn.value; loopOut.textContent = `${G.loop} s`; changed(); });
document.getElementById("g-reset").addEventListener("click", () => {
  Object.assign(P, JSON.parse(JSON.stringify(DEFAULT_P))); G.size = DEFAULT_G.size; G.loop = DEFAULT_G.loop;
  try { localStorage.removeItem(STORE); } catch (e) {}
  syncBarInputs(); applyCanvasSize(); bindings.forEach(b => b()); changed();
});
const playBtn = document.getElementById("g-play"), scrub = document.getElementById("g-scrub");
function setPlaying(v){ G.playing = v; playBtn.textContent = v ? "Pause" : "Play"; playBtn.setAttribute("aria-pressed", String(!v)); }
playBtn.addEventListener("click", () => setPlaying(!G.playing));
scrub.addEventListener("input", () => { setPlaying(false); G.t = +scrub.value; render(); });

function settingsJSON(){
  const out = { tool:"nicholascharriere.com/paperplanes", layout:"caption", frame:G.size, loopSeconds:G.loop, theme:G.theme, line:lineText() };
  for (const [k, v] of Object.entries(P)) if (k !== "line" && k !== "custom") out[k] = v;
  return JSON.stringify(out, null, 2);
}
const copyBtn = document.getElementById("g-copy");
copyBtn.addEventListener("click", () => {
  const txt = settingsJSON(), box = document.getElementById("copybox"), ta = document.getElementById("copytext");
  const ok = () => { copyBtn.textContent = "Copied"; setTimeout(() => copyBtn.textContent = "Copy settings", 1600); box.hidden = true; };
  const fail = () => { ta.value = txt; box.hidden = false; ta.focus(); ta.select(); };
  try { navigator.clipboard.writeText(txt).then(ok, fail); } catch (e) { fail(); }
});

/* ---------- render loop ---------- */
function render(){
  const [W,H] = dims();
  drawFrame(ctx, W, H, G.t, G.theme);
  miniCtx.imageSmoothingQuality = "high";
  miniCtx.drawImage(canvas, 0, 0, mini.width, mini.height);
  drawCloseup(closeCtx, closeup.width, closeup.height, G.t, G.theme);
  meter.style.width = `${(G.t*100).toFixed(2)}%`;
}
function changed(){ syncGated(); updateLines(); updateNotes(); drawSwatches(); save(); if (!G.playing) render(); }
let last = performance.now(), alive = true;
function frame(now){
  if (!alive) return;
  const dt = Math.min(0.1, (now - last)/1000); last = now;
  if (G.playing){ G.t = (G.t + dt/G.loop) % 1; scrub.value = G.t; render(); }
  requestAnimationFrame(frame);
}
// pin the preview just under the playback bar (the bar only sticks on wider screens)
const bar = root.querySelector(".bar");
function syncBar(){ const sticky = getComputedStyle(bar).position === "sticky"; root.style.setProperty("--bar-h", sticky ? `${bar.offsetHeight}px` : "0px"); }
const barWatch = "ResizeObserver" in window ? new ResizeObserver(syncBar) : null;
if (barWatch) barWatch.observe(bar);
window.addEventListener("resize", syncBar); syncBar();
// follow the site's light/dark toggle
const themeWatch = new MutationObserver(() => { const t = initialTheme(); if (t !== G.theme){ G.theme = t; document.getElementById(`g-theme-${t}`).checked = true; changed(); } });
themeWatch.observe(document.documentElement, { attributes:true, attributeFilter:["class"] });
setPlaying(G.playing); scrub.value = G.t; syncGated(); updateLines(); updateNotes(); drawSwatches(); render(); requestAnimationFrame(frame);
return () => { alive = false; window.removeEventListener("resize", syncBar); if (barWatch) barWatch.disconnect(); themeWatch.disconnect(); };
}
