export const PARAMETERS = {
  g: 0.5,
  m: 20,
  x0: 12,
  L0: 180,
  boxS: 40,
  W: 640,
  H: 520,
};
export function createJumpModel() {
  const { g, m, x0, L0, boxS, H } = PARAMETERS;
  const k = (m * g) / x0,
    groundY = H - 70;
  const ball = {};
  function reset(type = ball.type || 1) {
    Object.assign(ball, {
      type,
      yA: 0,
      yB: groundY,
      vA: 0,
      vB: 0,
      locked: false,
      lifted: false,
      active: true,
    });
    if (type === 1) {
      ball.yA = groundY - boxS;
      ball.vA = -Math.sqrt(2 * g * 280);
      ball.message = "质点 A 竖直上抛，观察速度减小与高度增加的过程。";
    } else {
      ball.yA = groundY - boxS - (L0 - (type === 2 ? 3 : 10) * x0) - boxS;
      ball.message =
        type === 2
          ? "弹簧压缩 3x₀ 后释放，观察伸长 x₀ 时的离地临界。"
          : "弹簧压缩 10x₀ 后释放，恢复原长时两物体锁定，随后整体上升。";
    }
  }
  function substep(dt) {
    if (ball.type === 1) {
      ball.vA += g * dt;
      ball.yA += ball.vA * dt;
      if (ball.yA > groundY - boxS) {
        ball.yA = groundY - boxS;
        ball.active = false;
        ball.message = "模型 1 结束：质点已落回地面。";
      }
    } else if (ball.type === 2) {
      const currentL = ball.yB - boxS - (ball.yA + boxS);
      const Fs = k * (L0 - currentL); // 正 = 压缩（推 A 向上），负 = 拉伸（拉 B 向上）
      ball.vA += (g - Fs / m) * dt;
      ball.yA += ball.vA * dt;
      // B 离地条件：弹簧拉伸的拉力 -Fs 大于 B 的重力 m·g，即拉伸量超过 x₀
      if (-Fs > m * g || ball.yB < groundY) {
        ball.vB += (g + Fs / m) * dt;
        ball.yB += ball.vB * dt;
      }
      if (ball.yB < groundY && !ball.lifted) {
        ball.lifted = true;
        ball.message =
          "弹簧拉伸量达到 x₀：弹力 k·x₀ = mg " +
          "恰好等于 B 的重力，B 到达离地临界。3x₀ 正是临界压缩量，B 刚好离地即回落。";
      }
    } else if (ball.type === 3) {
      if (!ball.locked) {
        const currentL = ball.yB - boxS - (ball.yA + boxS);
        const Fs = k * (L0 - currentL);
        ball.vA += (g - Fs / m) * dt;
        ball.yA += ball.vA * dt;
        if (currentL >= L0) {
          // 弹簧恢复原长：A、B 锁定为整体，动量守恒 mv = 2m·v'，v' = v/2
          ball.locked = true;
          ball.vA = ball.vA / 2;
          ball.vB = ball.vA;
        }
      } else {
        ball.vA += g * dt;
        ball.vB = ball.vA;
        ball.yA += ball.vA * dt;
        ball.yB += ball.vB * dt;
      }
    }

    if (ball.type !== 1 && ball.yB > groundY) {
      ball.yB = groundY;
      ball.vB = 0;
      if (ball.locked || (ball.type === 2 && ball.vA > 0)) {
        ball.active = false;
        ball.message += " 演示结束。";
      }
    }
  }

  function step(dt) {
    // 保留参考模型的积分精度，时间由调用方传入，避免演示速度随屏幕刷新率变化。
    const count = Math.max(10, Math.ceil(dt / 0.025));
    for (let i = 0; i < count && ball.active; i++) substep(dt / count);
  }
  function snapshot() {
    const length = ball.yB - boxS - (ball.yA + boxS);
    const deformation = (L0 - length) / x0;
    return {
      ...ball,
      height: Math.max(0, groundY - ball.yA - boxS),
      deformation,
    };
  }
  reset();
  return { ball, reset, step, snapshot };
}
