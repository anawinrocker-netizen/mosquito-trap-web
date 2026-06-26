/* ============================================================
   background.js — ambient "sensor network" field
   A faint IoT mesh behind every page: slowly drifting nodes,
   thin lines when near, rare expanding "ping" rings (echoes the
   dashboard radar signature). Self-injects a fixed full-page
   <canvas> at z-index:-2 (below the CSS vignette, below content).

   Quality floor:
   - LOW density (~70 desktop / ~35 mobile), ~30fps cap
   - pauses while the tab is hidden (visibilitychange)
   - prefers-reduced-motion: render ONE static mesh, no loop
   - vanilla JS, no dependencies

   To tune for a slow presentation laptop, lower NODE_COUNT_DESKTOP
   below (or set both counts to 0 to disable the mesh entirely —
   the navy base + vignette still look correct).
   ============================================================ */
(function () {
  "use strict";

  /* ---- Tunables (drop these if a laptop lags) ---- */
  var NODE_COUNT_DESKTOP = 70;
  var NODE_COUNT_MOBILE  = 35;
  var LINK_DIST   = 132;   // px: draw a line when two nodes are closer than this
  var TARGET_FPS  = 30;
  var PING_CHANCE = 0.0016; // per eligible node per frame — rare

  var COL_NODE   = "69,201,245";  // --cyan
  var COL_NODE2  = "138,147,255"; // --indigo
  var COL_LINE   = "120,150,210";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isMobile = window.matchMedia("(max-width: 680px)").matches;

  /* ---- Canvas ---- */
  var canvas = document.createElement("canvas");
  canvas.id = "bgCanvas";
  canvas.setAttribute("aria-hidden", "true");
  var s = canvas.style;
  s.position = "fixed";
  s.inset = "0";
  s.width = "100%";
  s.height = "100%";
  s.zIndex = "-2";
  s.pointerEvents = "none";
  s.background = "var(--bg-deep, #0A101F)";

  function mount() {
    (document.body || document.documentElement).appendChild(canvas);
    init();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }

  var ctx, W, H, DPR, nodes = [], pings = [], raf = null, lastFrame = 0;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function makeNodes() {
    var n = isMobile ? NODE_COUNT_MOBILE : NODE_COUNT_DESKTOP;
    nodes = [];
    for (var i = 0; i < n; i++) {
      nodes.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        r: 0.8 + Math.random() * 1.4,
        a: 0.20 + Math.random() * 0.18,          // node alpha 0.20–0.38
        c: Math.random() < 0.5 ? COL_NODE : COL_NODE2
      });
    }
  }

  function drawLinks() {
    for (var i = 0; i < nodes.length; i++) {
      for (var j = i + 1; j < nodes.length; j++) {
        var dx = nodes[i].x - nodes[j].x;
        var dy = nodes[i].y - nodes[j].y;
        var d2 = dx * dx + dy * dy;
        if (d2 < LINK_DIST * LINK_DIST) {
          var t = 1 - Math.sqrt(d2) / LINK_DIST;     // 0..1 closeness
          ctx.strokeStyle = "rgba(" + COL_LINE + "," + (0.06 + t * 0.06).toFixed(3) + ")";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }
    }
  }

  function drawNodes() {
    for (var i = 0; i < nodes.length; i++) {
      var p = nodes[i];
      ctx.fillStyle = "rgba(" + p.c + "," + p.a.toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPings() {
    for (var i = pings.length - 1; i >= 0; i--) {
      var g = pings[i];
      g.r += 0.55;
      g.life -= 0.012;
      if (g.life <= 0) { pings.splice(i, 1); continue; }
      ctx.strokeStyle = "rgba(" + COL_NODE + "," + (g.life * 0.22).toFixed(3) + ")";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function step() {
    for (var i = 0; i < nodes.length; i++) {
      var p = nodes[i];
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < -10) p.x = W + 10; else if (p.x > W + 10) p.x = -10;
      if (p.y < -10) p.y = H + 10; else if (p.y > H + 10) p.y = -10;
      if (pings.length < 4 && Math.random() < PING_CHANCE) {
        pings.push({ x: p.x, y: p.y, r: 2, life: 1 });
      }
    }
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    drawLinks();
    drawNodes();
    drawPings();
  }

  var frameInterval = 1000 / TARGET_FPS;
  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (now - lastFrame < frameInterval) return;
    lastFrame = now;
    step();
    render();
  }

  function start() { if (!raf && !reduce) raf = requestAnimationFrame(loop); }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

  function init() {
    ctx = canvas.getContext("2d");
    if (!ctx) return;
    resize();
    makeNodes();

    if (reduce) {
      render(); // single static mesh frame, no animation loop
      return;
    }

    window.addEventListener("resize", function () {
      resize();
      makeNodes();
    });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop(); else start();
    });
    start();
  }
})();
