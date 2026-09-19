import { createJumpModel, PARAMETERS } from "./physics.js";
export function createJumpSimulation(canvas, onUpdate) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("当前浏览器无法绘制实验画面。");
  const { W, H, boxS, L0, x0 } = PARAMETERS;
  const groundY = H - 70,
    centerX = W / 2;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);
  const model = createJumpModel(),
    ball = model.ball;
  let raf = null,
    lastTime = null,
    speed = 0.2,
    running = false,
    disposed = false;
  // 画圆角矩形
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawBox(cx, top, color, label) {
    const x = cx - boxS / 2;
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    roundRect(x, top, boxS, boxS, 7);
    const grad = ctx.createLinearGradient(x, top, x, top + boxS);
    grad.addColorStop(0, color);
    grad.addColorStop(1, shade(color, -25));
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 17px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, cx, top + boxS / 2 + 1);
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, (n >> 16) + amt));
    const gC = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
    const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
    return "rgb(" + r + "," + gC + "," + b + ")";
  }

  function drawSpring(x, top, bottom) {
    const lead = 14; // 两端直线段
    const turns = 10;
    const amp = 13;
    const bodyTop = top + lead;
    const bodyBottom = bottom - lead;
    const step = (bodyBottom - bodyTop) / (turns * 2);

    ctx.beginPath();
    ctx.strokeStyle = "#8fa3c8";
    ctx.lineWidth = 2.2;
    ctx.lineJoin = "round";
    ctx.moveTo(x, top);
    ctx.lineTo(x, bodyTop);
    for (let i = 0; i < turns * 2; i++) {
      ctx.lineTo(x + (i % 2 === 0 ? amp : -amp), bodyTop + step * (i + 0.5));
    }
    ctx.lineTo(x, bodyBottom);
    ctx.lineTo(x, bottom);
    ctx.stroke();
  }

  function drawGround() {
    // 地面条
    ctx.fillStyle = "#2b3a55";
    ctx.fillRect(0, groundY, W, 4);
    // 斜纹阴影
    ctx.beginPath();
    ctx.strokeStyle = "rgba(143, 163, 200, 0.25)";
    ctx.lineWidth = 1.5;
    for (let x = 8; x < W; x += 18) {
      ctx.moveTo(x, groundY + 4);
      ctx.lineTo(x - 10, groundY + 18);
    }
    ctx.stroke();
  }

  // 离地临界线：B 贴地时，弹簧被拉长 x0 对应的 A 底面高度
  // 此时弹力 k·x0 = m·g，恰好等于 B 的重力 —— 再拉一点 B 就会离地
  function drawCriticalLine() {
    const critY = groundY - boxS - (L0 + x0); // A 底面的临界高度
    ctx.beginPath();
    ctx.strokeStyle = "rgba(229, 83, 75, 0.55)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.moveTo(60, critY);
    ctx.lineTo(W - 60, critY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(229, 83, 75, 0.9)";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText("离地临界线：弹簧伸长 x₀（弹力 k·x₀ = mg）", 64, critY - 5);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawGround();

    if (ball.type === 1) {
      if (ball.active || ball.yA < groundY - boxS) {
        drawBox(centerX, ball.yA, "#f09a3e", "A");
      } else {
        drawBox(centerX, groundY - boxS, "#f09a3e", "A");
      }
      return;
    }

    if ((ball.type === 2 || ball.type === 3) && ball.yB >= groundY - 0.5) {
      drawCriticalLine();
    }

    // A 底部 = yA + boxS；B 顶部 = yB - boxS
    drawSpring(centerX, ball.yA + boxS, ball.yB - boxS);
    drawBox(centerX, ball.yA, "#4f8cff", "A");
    drawBox(centerX, ball.yB - boxS, "#34c07c", "B");

    if (ball.locked) {
      ctx.strokeStyle = "rgba(229, 83, 75, 0.9)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 5]);
      roundRect(
        centerX - boxS / 2 - 8,
        ball.yA - 8,
        boxS + 16,
        ball.yB - ball.yA + 16,
        10,
      );
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#e5534b";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(
        "已锁定 (v/2)",
        centerX + boxS / 2 + 16,
        (ball.yA + ball.yB) / 2,
      );
    }
  }

  function render() {
    draw();
    onUpdate({ ...model.snapshot(), running });
  }
  function loop(time) {
    raf = null;
    if (!running || disposed) return;
    const elapsed =
      lastTime === null ? 0 : Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;
    model.step(elapsed * 60 * speed);
    if (!ball.active) running = false;
    render();
    if (running) raf = requestAnimationFrame(loop);
  }
  function pause() {
    running = false;
    cancelAnimationFrame(raf);
    raf = null;
    lastTime = null;
    render();
  }
  function play() {
    if (running || disposed) return;
    if (!ball.active) model.reset();
    running = true;
    lastTime = null;
    render();
    raf = requestAnimationFrame(loop);
  }
  function reset(type = ball.type) {
    pause();
    model.reset(type);
    render();
  }
  render();
  return {
    play,
    pause,
    reset,
    setSpeed(value) {
      speed = value;
    },
    dispose() {
      disposed = true;
      running = false;
      cancelAnimationFrame(raf);
    },
  };
}
