/* ============================================================
   liquid.js — wires up ".glass-liquid" panels
   - injects the 3-blob fx layer behind the content (CSS animates it)
   - pointer-reactive sheen: sets --mx/--my from cursor (rAF-throttled),
     only on fine pointers and only when motion is allowed
   - pauses all liquid animation while the tab is hidden
   The visuals are 100% CSS; this file only adds structure + interaction.
   ============================================================ */
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(pointer: fine)").matches;

  function enhance() {
    var cards = document.querySelectorAll(".glass-liquid");
    if (!cards.length) return;

    cards.forEach(function (card) {
      // inject blob field as the first child (CSS: .lg-fx → z-index 0)
      if (!card.querySelector(".lg-fx")) {
        var fx = document.createElement("div");
        fx.className = "lg-fx";
        fx.setAttribute("aria-hidden", "true");
        fx.innerHTML = "<b></b><b></b><b></b>";
        card.insertBefore(fx, card.firstChild);
      }

      // pointer-reactive sheen (skip on touch / reduced motion)
      if (finePointer && !reduce) {
        var queued = false, px = 50, py = 50;
        card.addEventListener("pointermove", function (e) {
          var r = card.getBoundingClientRect();
          px = ((e.clientX - r.left) / r.width) * 100;
          py = ((e.clientY - r.top) / r.height) * 100;
          if (!queued) {
            queued = true;
            requestAnimationFrame(function () {
              card.style.setProperty("--mx", px.toFixed(1) + "%");
              card.style.setProperty("--my", py.toFixed(1) + "%");
              queued = false;
            });
          }
        });
        card.addEventListener("pointerleave", function () {
          card.style.removeProperty("--mx");
          card.style.removeProperty("--my");
        });
      }
    });

    // pause liquid motion when the tab is hidden (saves battery/GPU)
    if (!reduce) {
      document.addEventListener("visibilitychange", function () {
        document.body.classList.toggle("lg-paused", document.hidden);
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enhance, { once: true });
  } else {
    enhance();
  }
})();
