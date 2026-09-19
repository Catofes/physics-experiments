export function createMonitor(canvas) {
  const ctx = canvas.getContext("2d");
  const samples = [];
  function draw() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, canvas.clientWidth),
      height = Math.max(1, canvas.clientHeight);
    if (
      canvas.width !== Math.round(width * dpr) ||
      canvas.height !== Math.round(height * dpr)
    ) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#101c28";
    ctx.fillRect(0, 0, width, height);
    const end = samples.at(-1)?.t || 0;
    for (const [index, key, label, color] of [
      [0, "ux", "Ux 扫描电压", "#69c9d5"],
      [1, "uy", "Uy 偏转电压", "#f492b1"],
    ]) {
      const center = (height * (index + 0.5)) / 2;
      ctx.strokeStyle = "#30414c";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, center);
      ctx.lineTo(width, center);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = "11px system-ui";
      ctx.fillText(label, 12, (index * height) / 2 + 18);
      for (let i = 1; i < samples.length; i++) {
        const a = samples[i - 1],
          b = samples[i];
        ctx.strokeStyle = key === "ux" && b.blank ? "#687984" : color;
        ctx.beginPath();
        ctx.moveTo(
          ((a.t - end + 10) / 10) * width,
          center - (a[key] / 45) * (height / 4 - 20),
        );
        ctx.lineTo(
          ((b.t - end + 10) / 10) * width,
          center - (b[key] / 45) * (height / 4 - 20),
        );
        ctx.stroke();
      }
    }
  }
  const observer = new ResizeObserver(draw);
  observer.observe(canvas);
  return {
    push(sample) {
      samples.push(sample);
      while (samples.length && samples[0].t < sample.t - 10) samples.shift();
      draw();
    },
    clear() {
      samples.length = 0;
      draw();
    },
    dispose() {
      observer.disconnect();
      samples.length = 0;
    },
  };
}
