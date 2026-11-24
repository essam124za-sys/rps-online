const $ = id => document.getElementById(id);
const TARGET = 50; // المسافة لخط النهاية
const DIFF = { easy: { base: 300, jit: 160 }, mid: { base: 210, jit: 110 }, hard: { base: 150, jit: 90 } };
// العربيات: الاسم، السعر بالعملات، اللون، الخط، السرعة (كل ضغطة بتمشّي العربية قد إيه)
const CARS = [
  { n: "عربيتي", p: 0, c: "#d62828", st: "", s: 1 },
  { n: "الشهاب", p: 5, c: "#1d4ed8", st: "", s: 1.1 },
  { n: "الصقر", p: 10, c: "#eab308", st: "", s: 1.2 },
  { n: "النمر", p: 15, c: "#7c3aed", st: "", s: 1.3 },
  { n: "الفهد", p: 20, c: "#f97316", st: "#fff", s: 1.45 },
  { n: "البرق", p: 25, c: "#94a3b8", st: "#1d4ed8", s: 1.6 },
  { n: "الأسطورة", p: 30, c: "#111827", st: "#facc15", s: 1.8 }
];

const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
let coins = +ls.get("race_coins", 0) || 0, owned = ls.get("race_owned", [0]), sel = +ls.get("race_car", 0) || 0;
if (!Array.isArray(owned) || owned.indexOf(0) < 0) owned = [0];
if (owned.indexOf(sel) < 0) sel = 0;
function saveAll() { ls.set("race_coins", coins); ls.set("race_owned", owned); ls.set("race_car", sel); }

let mode = "ai", aiLevel = "mid", AI = DIFF.mid, me = 0, socket = null;
let pos = [0, 0], target = TARGET, scores = [0, 0], lname = ["", ""];
let running = false, over = false, aiTimer = null, cd = [];

// ---------- رسم العربيات ----------
let uid = 0;
function shade(h, f) { // f سالب = أغمق، موجب = أفتح
  const n = parseInt(h.slice(1), 16), k = f < 0 ? 1 + f / 100 : 1, m = f > 0 ? f / 100 : 0;
  const t = v => Math.max(0, Math.min(255, Math.round(v * k + 255 * m)));
  return "rgb(" + t((n >> 16) & 255) + "," + t((n >> 8) & 255) + "," + t(n & 255) + ")";
}
function beams(id) {
  return '<path d="M13 8 L-4 -75 L26 -75 Z" fill="url(#' + id + 'b)"/><path d="M47 8 L34 -75 L64 -75 Z" fill="url(#' + id + 'b)"/>';
}
function defs(id, color) {
  return '<defs><linearGradient id="' + id + '" x1="0" x2="1"><stop offset="0" stop-color="' + shade(color, -40) + '"/><stop offset=".5" stop-color="' + shade(color, 12) + '"/><stop offset="1" stop-color="' + shade(color, -40) + '"/></linearGradient>' +
    '<linearGradient id="' + id + 'b" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>';
}
// عربية سبورت (شكلها من فوق)
function car(color, stripe, w, beam) {
  const id = "g" + (++uid), W = w || 60;
  return '<svg viewBox="0 0 60 110" width="' + W + '" height="' + Math.round(W * 110 / 60) + '" style="overflow:visible" aria-hidden="true">' + defs(id, color) + (beam ? beams(id) : '') +
    '<ellipse cx="30" cy="60" rx="28" ry="50" fill="#000" opacity=".28"/>' +
    '<rect x="2" y="16" width="9" height="22" rx="3" fill="#111"/><rect x="49" y="16" width="9" height="22" rx="3" fill="#111"/>' +
    '<rect x="2" y="68" width="9" height="24" rx="3" fill="#111"/><rect x="49" y="68" width="9" height="24" rx="3" fill="#111"/>' +
    '<path d="M30 4C46 4 52 20 52 38L53 80C53 98 45 107 30 107C15 107 7 98 7 80L8 38C8 20 14 4 30 4Z" fill="url(#' + id + ')" stroke="rgba(0,0,0,.5)" stroke-width="1.5"/>' +
    '<path d="M30 8C41 8 46 20 46 34L14 34C14 20 19 8 30 8Z" fill="#fff" opacity=".2"/>' +
    (stripe ? '<rect x="27" y="4" width="6" height="103" fill="' + stripe + '" opacity=".9"/>' : '') +
    '<path d="M15 40Q30 33 45 40L42 56Q30 52 18 56Z" fill="#15233b"/><path d="M18 42Q30 37 42 42L41 46Q30 42 19 46Z" fill="#8fb8e8" opacity=".5"/>' +
    '<rect x="17" y="56" width="26" height="16" rx="6" fill="url(#' + id + ')" stroke="rgba(0,0,0,.35)"/>' +
    '<path d="M18 73Q30 77 42 73L40 84Q30 87 20 84Z" fill="#15233b"/>' +
    '<ellipse cx="17" cy="9" rx="5" ry="2.6" fill="#dff0ff"/><ellipse cx="43" cy="9" rx="5" ry="2.6" fill="#dff0ff"/>' +
    '<rect x="12" y="102" width="10" height="3" rx="1.5" fill="#ff3b3b"/><rect x="38" y="102" width="10" height="3" rx="1.5" fill="#ff3b3b"/></svg>';
}
// عربية فورمولا (للمنافس)
function kart(color, beam) {
  const id = "g" + (++uid);
  return '<svg viewBox="0 0 60 110" width="60" height="110" style="overflow:visible" aria-hidden="true">' + defs(id, color) + (beam ? beams(id) : '') +
    '<ellipse cx="30" cy="60" rx="28" ry="50" fill="#000" opacity=".28"/>' +
    '<rect x="3" y="14" width="10" height="22" rx="4" fill="#111"/><rect x="47" y="14" width="10" height="22" rx="4" fill="#111"/>' +
    '<rect x="1" y="70" width="12" height="26" rx="4" fill="#111"/><rect x="47" y="70" width="12" height="26" rx="4" fill="#111"/>' +
    '<rect x="12" y="22" width="36" height="3" fill="#333"/><rect x="12" y="82" width="36" height="3" fill="#333"/>' +
    '<rect x="6" y="3" width="48" height="9" rx="3" fill="#1a1a1a"/><rect x="6" y="5" width="48" height="3" fill="' + color + '"/>' +
    '<path d="M30 8L37 30L41 52L41 92L19 92L19 52L23 30Z" fill="url(#' + id + ')" stroke="rgba(0,0,0,.5)" stroke-width="1.2"/>' +
    '<rect x="12" y="48" width="9" height="36" rx="4" fill="url(#' + id + ')" stroke="rgba(0,0,0,.4)"/><rect x="39" y="48" width="9" height="36" rx="4" fill="url(#' + id + ')" stroke="rgba(0,0,0,.4)"/>' +
    '<ellipse cx="30" cy="60" rx="7" ry="11" fill="#0c1a12"/><circle cx="30" cy="58" r="4.5" fill="#d7ffe0" opacity=".8"/>' +
    '<rect x="8" y="96" width="44" height="10" rx="3" fill="#1a1a1a"/><rect x="8" y="98" width="44" height="3" fill="' + color + '"/></svg>';
}
function setCarLook() {
  $("c0").innerHTML = car(CARS[sel].c, CARS[sel].st, 60, true);
  $("c1").innerHTML = kart("#3fae2a", true);
}
function renderCoins() { $("coins").innerHTML = "<b>" + coins + "</b><i class=\"coin\"></i>"; }

// ---------- الرسم ----------
function render() {
  [0, 1].forEach(i => {
    const lane = $("l" + i);
    const travel = Math.max(0, lane.clientHeight - 110 - 40 - 34);
    $("c" + i).style.transform = "translateY(" + (-travel * Math.min(1, pos[i] / target)) + "px)";
    const y = (pos[i] * 22) + "px";
    $("d" + i).style.backgroundPositionY = y;
    $("s" + i).style.backgroundPositionY = y;
  });
  $("score").innerHTML = '<i class="dot r"></i><b>' + scores[0] + " : " + scores[1] + '</b><i class="dot g"></i>';
  const early = pos[0] <= 2 && pos[1] <= 2;
  $("h0").style.visibility = $("h1").style.visibility = early ? "visible" : "hidden";
}
window.addEventListener("resize", render);

function setLabels() {
  if (mode === "same") {
    lname = ["الأحمر", "الأخضر"];
    $("h0").textContent = $("h1").textContent = "👆 دوس هنا بسرعة";
  } else if (mode === "ai") {
    lname = ["أنت", "الكمبيوتر 🤖"];
    $("h0").textContent = "👆 دوس في أي مكان بسرعة"; $("h1").textContent = "";
  } else {
    $("h0").textContent = "👆 دوس في أي مكان بسرعة"; $("h1").textContent = "";
  }
  $("n0").textContent = lname[0]; $("n1").textContent = lname[1];
}

function say(t, small) {
  $("overlay").textContent = t;
  $("overlay").className = small ? "small" : "";
}

// ---------- الجولة ----------
function ready() {
  over = false; running = false; pos = [0, 0];
  render();
  say("اضغط «ابدأ السباق» 🏁", true);
  $("again").textContent = "ابدأ السباق";
  $("after").hidden = false;
}

function startRound(startIn) {
  cd.forEach(clearTimeout); cd = [];
  clearTimeout(aiTimer);
  over = false; running = false; pos = [0, 0];
  $("after").hidden = true;
  render();
  const step = startIn / 3;
  ["3", "2", "1"].forEach((t, i) => cd.push(setTimeout(() => say(t), i * step)));
  cd.push(setTimeout(() => {
    say("انطلق! 🏁"); running = true;
    if (mode === "ai") aiLoop();
    cd.push(setTimeout(() => say(""), 700));
  }, startIn));
  say("جاهز؟");
}

function aiLoop() {
  if (!running || mode !== "ai") return;
  aiTimer = setTimeout(() => {
    if (!running) return;
    pos[1] += 1; render();
    if (pos[1] >= target) return finish(1, true);
    aiLoop();
  }, AI.base + Math.random() * AI.jit);
}

function tap(side) {
  if (!running) return;
  if (mode === "online") { socket.emit("race:tap"); return; }
  pos[side] += CARS[sel].s; // العربية الأغلى بتمشي أكتر في كل ضغطة
  render();
  if (pos[side] >= target) finish(side, true);
}

function finish(w, inc) {
  if (over) return;
  over = true; running = false;
  clearTimeout(aiTimer);
  if (inc) scores[w]++;
  render();
  let gain = 0;
  if (mode === "ai" && w === 0 && aiLevel !== "easy") gain = 1;
  else if (mode === "same") gain = 2;
  else if (mode === "online" && w === 0) gain = 2;
  if (gain) { coins += gain; saveAll(); renderCoins(); }
  let t;
  if (mode === "same") t = w === 0 ? "🔴 الأحمر كسب! 🏆" : "🟢 الأخضر كسب! 🏆";
  else t = w === 0 ? "كسبت! 🏆" : lname[1].replace(/ ?🤖/gu, "") + " كسب 😅";
  if (gain) t += "\n+" + gain + " 🪙";
  say(t, true);
  $("again").textContent = "جولة جديدة";
  $("again").hidden = false;
  $("after").hidden = false;
}

$("track").addEventListener("pointerdown", e => {
  e.preventDefault();
  if (!running) return;
  if (mode === "same") {
    const l = e.target.closest ? e.target.closest(".lane") : null;
    if (l) tap(+l.dataset.i);
  } else tap(0);
});

function enterRace(startIn) {
  $("menu").hidden = true;
  scores = [0, 0];
  setLabels();
  if (startIn) startRound(startIn);
}

$("again").onclick = () => {
  if (mode === "online" && socket) socket.emit("race:again");
  else startRound(3000);
};

// ---------- القائمة: العب مع مين؟ ----------
function show(id) {
  ["s-mode", "s-diff", "s-name", "s-wait"].forEach(s => $(s).hidden = s !== id);
}
$("who").onclick = () => { show("s-mode"); $("menu").hidden = false; };
$("mx").onclick = () => { $("menu").hidden = true; };
$("m-same").onclick = () => { mode = "same"; enterRace(3000); };
$("m-ai").onclick = () => show("s-diff");
$("m-online").onclick = () => show("s-name");
$("diff-back").onclick = () => show("s-mode");
$("name-back").onclick = () => show("s-mode");
document.querySelectorAll("[data-d]").forEach(b => {
  b.onclick = () => { mode = "ai"; aiLevel = b.dataset.d; AI = DIFF[aiLevel]; enterRace(3000); };
});

// ---------- الجراج ----------
function renderGarage() {
  $("gcoins").innerHTML = "<b>" + coins + "</b> 🪙";
  $("glist").innerHTML = "";
  CARS.forEach((c, i) => {
    const d = document.createElement("div");
    d.className = "gi";
    d.innerHTML = '<div class="gcar">' + car(c.c, c.st, 34, false) + '</div><div class="ginfo"><b>' + c.n + '</b><div class="sbar"><i style="width:' + Math.round(c.s / 1.8 * 100) + '%"></i></div><small>' + (i === 0 ? "مجانية" : c.p + " عملة") + '</small></div>';
    const b = document.createElement("button");
    if (owned.indexOf(i) >= 0) {
      b.textContent = sel === i ? "مستخدمة ✓" : "اختار";
      b.disabled = sel === i;
      b.onclick = () => { sel = i; saveAll(); setCarLook(); renderGarage(); };
    } else {
      b.textContent = "اشتري 🪙" + c.p;
      b.disabled = coins < c.p;
      b.onclick = () => { coins -= c.p; owned.push(i); sel = i; saveAll(); renderCoins(); setCarLook(); renderGarage(); };
    }
    d.appendChild(b);
    $("glist").appendChild(d);
  });
}
$("gbtn").onclick = () => { renderGarage(); $("garage").hidden = false; };
$("gx").onclick = () => { $("garage").hidden = true; };

// ---------- اللعب أونلاين ----------
// مكتبة الاتصال بتتحمل هنا بس، عشان الأوضاع التانية تشتغل بدون نت
function withSocket(cb) {
  if (socket) return cb();
  const s = document.createElement("script");
  s.src = "/socket.io/socket.io.js";
  s.onload = () => { socket = io(); bindSocket(); cb(); };
  s.onerror = () => { $("err").textContent = "مفيش إنترنت. الوضع ده محتاج نت."; };
  document.head.appendChild(s);
}
function getName() {
  const n = $("name").value.trim();
  if (!n) { $("err").textContent = "اكتب اسمك الأول"; $("name").focus(); return null; }
  $("err").textContent = "";
  return n;
}
$("create").onclick = () => { const n = getName(); if (n) withSocket(() => socket.emit("race:create", n)); };
$("join").onclick = () => {
  const n = getName();
  if (n) withSocket(() => socket.emit("race:join", { code: $("code").value.trim(), name: n }));
};

function bindSocket() {
  socket.on("race:created", c => { $("roomcode").textContent = c; show("s-wait"); });
  socket.on("race:fail", m => { $("err").textContent = m; });
  socket.on("race:start", d => {
    mode = "online";
    me = d.ids.indexOf(socket.id);
    lname = [d.names[me], d.names[1 - me]];
    enterRace(0);
  });
  socket.on("race:round", d => startRound(d.startIn));
  socket.on("race:state", s => {
    target = s.target;
    pos = [s.pos[me], s.pos[1 - me]];
    if (s.over) {
      scores = [s.scores[me], s.scores[1 - me]];
      finish(s.winner === me ? 0 : 1, false);
    } else render();
  });
  socket.on("race:left", () => {
    running = false; over = true;
    say(lname[1] + " خرج من اللعبة", true);
    $("again").hidden = true;
    $("after").hidden = false;
  });
}

// ---------- أول ما اللعبة تفتح ----------
setCarLook();
renderCoins();
setLabels();
ready();
