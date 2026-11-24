// === مؤثرات الشرر والدخان أثناء السباق ===
(function addRaceVFX() {
  const style = document.createElement("style");
  style.textContent = `
    .vfx-spark {
      position: fixed;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      pointer-events: none;
      z-index: 9999;
      background: radial-gradient(circle, #fff 0%, #facc15 45%, #f97316 100%);
      box-shadow: 0 0 10px #f97316;
      animation: sparkFly 0.45s ease-out forwards;
    }
    .vfx-smoke {
      position: fixed;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      pointer-events: none;
      z-index: 9998;
      background: rgba(255, 255, 255, 0.45);
      filter: blur(4px);
      animation: smokeRise 0.55s ease-out forwards;
    }
    @keyframes sparkFly {
      0% { transform: translate(0, 0) scale(1); opacity: 1; }
      100% { transform: translate(var(--dx), var(--dy)) scale(0.1); opacity: 0; }
    }
    @keyframes smokeRise {
      0% { transform: translate(0, 0) scale(0.6); opacity: 0.7; }
      100% { transform: translate(var(--dx), 45px) scale(2.2); opacity: 0; }
    }
  `;
  document.head.appendChild(style);

  document.addEventListener("pointerdown", (e) => {
    if (typeof running !== "undefined" && !running) return;

    // توليد شرر مكان الضغطة
    for (let i = 0; i < 6; i++) {
      const s = document.createElement("div");
      s.className = "vfx-spark";
      s.style.left = e.clientX + "px";
      s.style.top = e.clientY + "px";
      s.style.setProperty("--dx", (Math.random() - 0.5) * 90 + "px");
      s.style.setProperty("--dy", (Math.random() - 0.5) * 90 + "px");
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 450);
    }

    // توليد دخان خفيف
    const sm = document.createElement("div");
    sm.className = "vfx-smoke";
    sm.style.left = (e.clientX - 10) + "px";
    sm.style.top = (e.clientY - 10) + "px";
    sm.style.setProperty("--dx", (Math.random() - 0.5) * 30 + "px");
    document.body.appendChild(sm);
    setTimeout(() => sm.remove(), 550);
  });
})();
