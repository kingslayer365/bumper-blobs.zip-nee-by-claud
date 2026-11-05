(() => {
const $ = id => document.getElementById(id);
const NAMES = ["Gold","Coral","Mint","Sky"], COL = ["#f2c14e","#ef476f","#06d6a0","#4cc9f0"];
const CX = 300, R0 = 270, RMIN = 105, PR = 20, WIN = 3;
let peer, hostConn, conns = [null,null,null,null], role = null, me = 0, code = "";
let phase = "menu", R = R0, tm = 0, banner = "", P = [], V = [];
const inp = { x:0, y:0, d:0 }, keys = {}, stick = { on:false, x:0, y:0, id:null, ox:0, oy:0 };
let dashHeld = false;
const cv = $("cv"), ctx = cv.getContext("2d");

function show(id) { ["menu","lobby","play"].forEach(s => $(s).classList.toggle("hidden", s !== id)); }
function err(m) {
  if (peer) try { peer.destroy(); } catch (e) {}
  role = null; phase = "menu"; conns = [null,null,null,null]; hostConn = null;
  $("menuMsg").textContent = m; show("menu");
}

// ---------- Rooms ----------
function create() {
  role = "host"; me = 0; tryHost(0);
}
function tryHost(n) {
  code = [0,1,2,3].map(() => "ABCDEFGHJKMNPQRSTUVWXYZ"[Math.random() * 23 | 0]).join("");
  peer = new Peer("bumper-" + code);
  peer.on("open", () => {
    P = [0,1,2,3].map(i => ({ x:0, y:0, vx:0, vy:0, alive:1, wins:0, cd:0, fx:1, fy:0, type:i ? null : "host", inp:{x:0,y:0,d:0} }));
    phase = "lobby"; lobbyCast(); show("lobby");
  });
  peer.on("connection", onConn);
  peer.on("error", e => (e.type === "unavailable-id" && n < 5) ? tryHost(n + 1) : err("Could not create a room. Check your connection."));
}
function onConn(c) {
  c.on("open", () => {
    const i = phase === "lobby" ? P.findIndex(p => !p.type) : -1;
    if (i < 0) { c.send({ t:"full" }); setTimeout(() => c.close(), 400); return; }
    P[i].type = "peer"; conns[i] = c; c.send({ t:"id", i }); lobbyCast();
    c.on("data", d => { if (d.t === "in") P[i].inp = d; });
    c.on("close", () => {
      conns[i] = null;
      if (phase === "lobby") { P[i].type = null; lobbyCast(); } else P[i].type = "bot";
    });
  });
}
function lobbyCast() {
  const m = { t:"l", c:code, s:P.map(p => p.type) };
  conns.forEach(c => c && c.send(m));
  renderLobby(m);
}
function renderLobby(m) {
  $("roomcode").textContent = m.c; code = m.c;
  $("slots").innerHTML = m.s.map((t, i) =>
    `<li><i style="background:${COL[i]}"></i>${NAMES[i]}<span>${i === me ? "You" : t === "peer" ? "Player" : t === "host" ? "Host" : "Open (bot)"}</span></li>`).join("");
  $("start").classList.toggle("hidden", role !== "host");
  $("wait").classList.toggle("hidden", role === "host");
}
function join(c) {
  role = "client"; code = c.toUpperCase().trim();
  if (code.length !== 4) return err("Enter the 4-letter room code.");
  $("menuMsg").textContent = "Connecting…";
  peer = new Peer();
  peer.on("open", () => {
    hostConn = peer.connect("bumper-" + code, { reliable:true });
    hostConn.on("data", onData);
    hostConn.on("close", () => err("The host left the room."));
    setTimeout(() => { if (hostConn && !hostConn.open && role === "client") err("Room not found."); }, 8000);
  });
  peer.on("error", e => err(e.type === "peer-unavailable" ? "Room not found." : "Connection problem. Try again."));
}
function onData(d) {
  if (d.t === "id") me = d.i;
  else if (d.t === "full") err("That room is full or already started.");
  else if (d.t === "l") { phase = "lobby"; renderLobby(d); show("lobby"); }
  else if (d.t === "s") {
    if (phase === "lobby") show("play");
    phase = d.ph; R = d.R; tm = d.tm; banner = d.b;
    d.p.forEach((a, i) => {
      const v = V[i] || (V[i] = { x:a[0], y:a[1], fx:1, fy:0 });
      v.tx = a[0]; v.ty = a[1]; v.alive = a[2]; v.wins = a[3]; v.cd = a[4]; v.type = a[5];
    });
  }
}

// ---------- Host simulation ----------
function newRound() {
  R = R0; banner = "";
  P.forEach((p, i) => {
    const a = i * Math.PI / 2 + Math.PI / 4;
    Object.assign(p, { x:CX + Math.cos(a) * 150, y:CX + Math.sin(a) * 150, vx:0, vy:0, alive:1, cd:0, fx:-Math.cos(a), fy:-Math.sin(a) });
  });
  phase = "count"; tm = 3;
}
function bot(p, al) {
  const dc = Math.hypot(p.x - CX, p.y - CX);
  if (dc > R - 55) return [(CX - p.x) / dc, (CX - p.y) / dc, 0];
  let t = null, bd = 1e9;
  for (const q of al) if (q !== p) { const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; t = q; } }
  return t ? [(t.x - p.x) / bd, (t.y - p.y) / bd, bd < 90 && Math.random() < .04 ? 1 : 0] : [0,0,0];
}
function step(dt) {
  if (phase === "count") { tm -= dt; if (tm <= 0) { phase = "play"; tm = 0; } return; }
  if (phase === "between") {
    tm -= dt;
    if (tm <= 0) {
      if (P.some(p => p.wins >= WIN)) { phase = "lobby"; P.forEach(p => { if (p.type === "bot") p.type = null; }); lobbyCast(); show("lobby"); }
      else newRound();
    }
    return;
  }
  if (phase !== "play") return;
  R = Math.max(RMIN, R - 8 * dt);
  const al = P.filter(p => p.alive);
  for (const p of al) {
    let [ix, iy, d] = p.type === "bot" ? bot(p, al) : [p.inp.x, p.inp.y, p.inp.d];
    const m = Math.hypot(ix, iy);
    if (m > 1) { ix /= m; iy /= m; }
    if (m > .15) { p.fx = ix / m; p.fy = iy / m; }
    p.vx += ix * 750 * dt; p.vy += iy * 750 * dt;
    p.cd = Math.max(0, p.cd - dt);
    if (d && p.cd <= 0) { p.vx += p.fx * 520; p.vy += p.fy * 520; p.cd = 1.5; }
    const f = Math.pow(.1, dt);
    p.vx *= f; p.vy *= f; p.x += p.vx * dt; p.y += p.vy * dt;
  }
  for (let i = 0; i < al.length; i++) for (let k = i + 1; k < al.length; k++) {
    const a = al[i], b = al[k]; let dx = b.x - a.x, dy = b.y - a.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < PR * 2) {
      dx /= d; dy /= d; const o = (PR * 2 - d) / 2;
      a.x -= dx * o; a.y -= dy * o; b.x += dx * o; b.y += dy * o;
      const vn = (b.vx - a.vx) * dx + (b.vy - a.vy) * dy;
      if (vn < 0) { const j = -1.05 * vn; a.vx -= j * dx; a.vy -= j * dy; b.vx += j * dx; b.vy += j * dy; }
    }
  }
  for (const p of al) if (Math.hypot(p.x - CX, p.y - CX) > R + PR * .4) p.alive = 0;
  const left = P.filter(p => p.alive);
  if (left.length <= 1) {
    if (left[0]) { left[0].wins++; const w = P.indexOf(left[0]); const done = left[0].wins >= WIN;
      banner = `${NAMES[w]} wins the ${done ? "match!" : "round"}`; tm = done ? 4 : 2.5; }
    else { banner = "Draw"; tm = 2; }
    phase = "between";
  }
}
function cast() {
  const m = { t:"s", ph:phase, R, tm:Math.ceil(tm), b:banner,
    p:P.map(p => [+p.x.toFixed(1), +p.y.toFixed(1), p.alive, p.wins, p.cd > 0 ? 1 : 0, p.type]) };
  conns.forEach(c => c && c.send(m));
}
function startGame() {
  P.forEach(p => { if (!p.type) p.type = "bot"; p.wins = 0; });
  newRound(); show("play");
}

// ---------- Rendering ----------
function getView() {
  if (role === "host") return P.map(p => ({ x:p.x, y:p.y, fx:p.fx, fy:p.fy, alive:p.alive, wins:p.wins, cd:p.cd > 0, type:p.type }));
  V.forEach(v => {
    const dx = v.tx - v.x, dy = v.ty - v.y, m = Math.hypot(dx, dy);
    if (m > .6) { v.fx = dx / m; v.fy = dy / m; }
    v.x += dx * .4; v.y += dy * .4;
  });
  return V;
}
function text(s, x, y, size, color, align = "center") {
  ctx.font = `700 ${size}px ui-rounded, "Trebuchet MS", system-ui, sans-serif`;
  ctx.textAlign = align; ctx.fillStyle = color; ctx.fillText(s, x, y);
}
function draw() {
  const view = getView();
  ctx.fillStyle = "#0a1d20"; ctx.fillRect(0, 0, 600, 600);
  ctx.beginPath(); ctx.arc(CX, CX, R, 0, 7); ctx.fillStyle = "#17434a"; ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = R < 160 ? "#ef476f" : "#2c6b73"; ctx.stroke();
  ctx.beginPath(); ctx.arc(CX, CX, R * .5, 0, 7); ctx.lineWidth = 2; ctx.strokeStyle = "rgba(232,241,239,.08)"; ctx.stroke();
  view.forEach((v, i) => {
    if (!v.type || !v.alive) return;
    ctx.globalAlpha = v.cd ? .7 : 1;
    ctx.beginPath(); ctx.arc(v.x, v.y, PR, 0, 7); ctx.fillStyle = COL[i]; ctx.fill();
    if (i === me) { ctx.lineWidth = 3; ctx.strokeStyle = "#fff"; ctx.stroke(); }
    ctx.globalAlpha = 1;
    const fx = v.fx || 1, fy = v.fy || 0;
    for (const s of [-1, 1]) {
      const ex = v.x + fx * 8 - fy * 6 * s, ey = v.y + fy * 8 + fx * 6 * s;
      ctx.beginPath(); ctx.arc(ex, ey, 5, 0, 7); ctx.fillStyle = "#fff"; ctx.fill();
      ctx.beginPath(); ctx.arc(ex + fx * 2, ey + fy * 2, 2.5, 0, 7); ctx.fillStyle = "#0a1d20"; ctx.fill();
    }
  });
  view.forEach((v, i) => { if (v.type) text(NAMES[i] + " " + "●".repeat(v.wins || 0), 14 + i * 148, 28, 17, COL[i], "left"); });
  const mine = view[me];
  if (phase === "count") text(tm, CX, CX + 28, 90, "#fff");
  else if (phase === "between") text(banner, CX, CX + 10, 38, "#fff");
  else if (phase === "play" && mine && !mine.alive) text("You're out. Watch the finish!", CX, 580, 22, "#fff");
  $("dash").classList.toggle("cool", !!(mine && mine.cd));
}

// ---------- Input ----------
function readInput() {
  let x = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0);
  let y = (keys.ArrowDown || keys.s ? 1 : 0) - (keys.ArrowUp || keys.w ? 1 : 0);
  if (stick.on) { x = stick.x; y = stick.y; }
  inp.x = x; inp.y = y; inp.d = keys[" "] || dashHeld ? 1 : 0;
}
addEventListener("keydown", e => { keys[e.key.length > 1 ? e.key : e.key.toLowerCase()] = true; if (e.key === " " || e.key.startsWith("Arrow")) e.preventDefault(); });
addEventListener("keyup", e => { keys[e.key.length > 1 ? e.key : e.key.toLowerCase()] = false; });
$("dash").addEventListener("pointerdown", e => { e.stopPropagation(); dashHeld = true; setTimeout(() => dashHeld = false, 150); });
addEventListener("pointerdown", e => {
  if ($("play").classList.contains("hidden") || e.target.id === "dash" || stick.on) return;
  Object.assign(stick, { on:true, id:e.pointerId, ox:e.clientX, oy:e.clientY, x:0, y:0 });
  for (const id of ["base","knob"]) { $(id).style.display = "block"; $(id).style.left = e.clientX + "px"; $(id).style.top = e.clientY + "px"; }
});
addEventListener("pointermove", e => {
  if (!stick.on || e.pointerId !== stick.id) return;
  let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy; const m = Math.hypot(dx, dy), max = 50;
  if (m > max) { dx = dx / m * max; dy = dy / m * max; }
  stick.x = dx / max; stick.y = dy / max;
  $("knob").style.left = stick.ox + dx + "px"; $("knob").style.top = stick.oy + dy + "px";
});
const endStick = e => { if (e.pointerId !== stick.id) return; stick.on = false; $("base").style.display = $("knob").style.display = "none"; };
addEventListener("pointerup", endStick); addEventListener("pointercancel", endStick);

// ---------- UI wiring ----------
$("create").onclick = create;
$("join").onclick = () => join($("codeIn").value);
$("start").onclick = startGame;
$("share").onclick = async () => {
  const url = location.origin + location.pathname + "?room=" + code;
  const data = { title:"Bumper Blobs", text:`Join my Bumper Blobs room: ${code}`, url };
  try { navigator.share ? await navigator.share(data) : await navigator.clipboard.writeText(url); } catch (e) {}
  if (!navigator.share) $("share").textContent = "Link copied!";
};
const q = new URLSearchParams(location.search).get("room");
if (q) { $("codeIn").value = q; join(q); }

// ---------- Main loop ----------
let last = performance.now(), acc = 0, tick = 0;
function loop(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  readInput();
  if (role === "host" && phase !== "lobby" && phase !== "menu") {
    P[0].inp = inp; acc += dt;
    while (acc >= 1 / 60) { step(1 / 60); acc -= 1 / 60; if (++tick % 2 === 0) cast(); }
  } else if (role === "client" && hostConn && hostConn.open && ++tick % 2 === 0) {
    hostConn.send({ t:"in", x:inp.x, y:inp.y, d:inp.d });
  }
  if (!$("play").classList.contains("hidden")) draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
})();
