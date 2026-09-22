import { onMounted, onUnmounted } from 'vue';
export function useAnimation(frame) {
  let id, last;
  function tick(now) {
    const dt = last === undefined ? 0 : Math.min(.05, (now - last) / 1000);
    last = now; frame(dt); id = requestAnimationFrame(tick);
  }
  onMounted(() => { id = requestAnimationFrame(tick); });
  onUnmounted(() => cancelAnimationFrame(id));
}
