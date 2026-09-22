<script setup>
import { computed, ref } from 'vue';
import ExperimentLayout from '../../components/ExperimentLayout.vue';
import Circuit from './Circuit.vue';
import { levels, resistor, connect, format, describe, steps, solve } from './model.js';
defineProps({ experiment: { type: Object, required: true } });
const levelIndex = ref(0), question = ref(0), selected = ref([]), history = ref([]), hintCount = ref(0), showAnswer = ref(false);
const level = computed(() => levels[levelIndex.value]);
const values = computed(() => level.value.puzzles[question.value]);
const nodes = ref(values.value.map(resistor));
const originalSolution = computed(() => solve(values.value.map(resistor)));
const solutionSteps = computed(() => steps(originalSolution.value));
const won = computed(() => nodes.value.length === 1 && nodes.value[0].value.n === 24 * nodes.value[0].value.d);
const result = computed(() => nodes.value.length === 1 ? format(nodes.value[0].value) : '—');
const progress = ref(new Set());
const assisted = ref(new Set());
function markAssisted() { assisted.value = new Set([...assisted.value, key.value]); }
const key = computed(() => `${levelIndex.value}:${question.value}`);
function reset() {
  nodes.value = values.value.map(resistor); selected.value = []; history.value = []; hintCount.value = 0; showAnswer.value = false;
}
function changeLevel(index) { levelIndex.value = index; question.value = 0; reset(); }
function next() { question.value = (question.value + 1) % level.value.puzzles.length; reset(); }
function select(id) {
  if (selected.value.includes(id)) selected.value = selected.value.filter(x => x !== id);
  else if (selected.value.length < 2) selected.value = [...selected.value, id];
}
function merge(op) {
  if (selected.value.length !== 2) return;
  const [a, b] = selected.value.map(id => nodes.value.find(n => n.id === id));
  history.value = [...history.value, nodes.value];
  nodes.value = [...nodes.value.filter(n => !selected.value.includes(n.id)), connect(a, b, op)];
  selected.value = [];
  if (won.value && !assisted.value.has(key.value)) progress.value = new Set([...progress.value, key.value]);
}
function undo() {
  if (!history.value.length) return;
  nodes.value = history.value.at(-1); history.value = history.value.slice(0, -1); selected.value = [];
}
</script>
<template>
  <ExperimentLayout :experiment="experiment" controls-title="挑战设置" class="resistance-game">
    <template #stage>
      <div class="game-stage">
        <div class="target-row"><div><span class="small-label">目标等效电阻</span><div class="target">24 <small>Ω</small></div></div><div class="question-counter">{{ level.title }} · 第 {{ question + 1 }} / {{ level.puzzles.length }} 题<br><span>{{ values.length }} 个电阻，每个用一次</span></div></div>
        <p class="stage-instruction">{{ nodes.length > 1 ? '选择两个元件或电路，再连接它们。' : '所有电阻已接入同一个电路。' }}</p>
        <div class="circuit-grid" :class="{ single: nodes.length === 1 }">
          <button v-for="node in nodes" :key="node.id" class="circuit-card" :class="{ selected: selected.includes(node.id), combined: node.op !== 'resistor' }" :aria-pressed="selected.includes(node.id)" :aria-label="`选择 ${describe(node)}`" :disabled="nodes.length === 1" @click="select(node.id)">
            <div class="card-meta"><span>{{ node.op === 'resistor' ? node.label : '组合电路' }}</span><strong>{{ format(node.value) }} Ω</strong></div>
            <Circuit :node="node" />
            <span class="selection-indicator">{{ nodes.length === 1 ? '两端等效电阻' : selected.includes(node.id) ? '✓ 已选中' : '点击选择' }}</span>
          </button>
        </div>
        <div class="game-result" role="status" :class="{ success: won }">
          <template v-if="won">连接成功！等效电阻恰好是 24 Ω。{{ assisted.has(key) ? '可以换一题独立挑战。' : '本题已独立完成。' }}</template>
          <template v-else-if="nodes.length === 1">当前为 {{ result }} Ω，还不是 24 Ω。撤销一步，试试其他连接。</template>
          <template v-else>已选 {{ selected.length }} / 2 · 剩余 {{ nodes.length }} 个独立电路</template>
        </div>
        <div class="game-actions" role="group" aria-label="电路操作">
          <button class="lab-button primary" :disabled="selected.length !== 2" @click="merge('series')">串联 ＋</button>
          <button class="lab-button primary" :disabled="selected.length !== 2" @click="merge('parallel')">并联 ∥</button>
          <button class="lab-button" :disabled="!history.length" @click="undo">撤销一步</button>
          <button class="lab-button" @click="reset">本题重来</button>
        </div>
      </div>
    </template>
    <template #playback><span hidden /></template>
    <template #observation>
      <p class="formula-note">串联：R = R₁ + R₂　　并联：R = R₁R₂ / (R₁ + R₂)</p>
      <details v-if="history.length" class="calculation"><summary>查看当前计算过程</summary><ol><li v-for="(step, i) in nodes.flatMap(steps)" :key="i">{{ step.text }}<br><strong>{{ step.calculation }}</strong></li></ol></details>
    </template>
    <template #controls>
      <div class="game-controls">
        <div class="difficulty" role="group" aria-label="题目难度"><button v-for="(item, i) in levels" :key="item.id" class="lab-button" :aria-pressed="levelIndex === i" @click="changeLevel(i)">{{ item.title }}</button></div>
        <p>{{ level.subtitle }}</p>
        <div class="question-picker" role="group" aria-label="选择题目"><button v-for="(_, i) in level.puzzles" :key="i" class="lab-button" :aria-pressed="question === i" :aria-label="`第 ${i + 1} 题${progress.has(`${levelIndex}:${i}`) ? '，已完成' : ''}`" @click="question = i; reset()">{{ i + 1 }}{{ progress.has(`${levelIndex}:${i}`) ? ' ✓' : '' }}</button></div>
        <p class="progress-note">本次独立完成 {{ progress.size }} / 12 题</p>
        <button class="lab-button primary wide" @click="next">{{ question === level.puzzles.length - 1 ? '回到本组第一题' : '下一题 →' }}</button>
        <div class="rules"><h2>连接规则</h2><p>所有电阻都要用，且各用一次。只允许串联和并联，导线电阻忽略不计。</p><p>先合并的电路仍可与其他电阻连接。结果用精确分数表示，不靠四舍五入凑 24。</p></div>
        <button class="lab-button wide" :disabled="hintCount >= solutionSteps.length" @click="markAssisted(); hintCount++">{{ hintCount ? '再提示一步' : '给我一点提示' }}</button>
        <div v-if="hintCount" class="hint-box" role="status"><p>一种参考路径（从初始电阻开始）：</p><ol><li v-for="(step, i) in solutionSteps.slice(0, hintCount)" :key="i">{{ step.text }}<br>{{ step.calculation }}</li></ol></div>
        <button class="answer-button" :aria-expanded="showAnswer" @click="markAssisted(); showAnswer = !showAnswer">{{ showAnswer ? '收起参考解' : '查看完整参考解' }}</button>
        <div v-if="showAnswer" class="answer-box"><Circuit :node="originalSolution" /><ol><li v-for="(step, i) in solutionSteps" :key="i">{{ step.text }}<br>{{ step.calculation }}</li></ol></div>
      </div>
    </template>
  </ExperimentLayout>
</template>
<style scoped>
.resistance-game { height: auto; min-height: 100dvh; }
.resistance-game :deep(.lab-layout) { align-items: start; }
.resistance-game :deep(.lab-stage) { overflow: visible; height: auto; }
.resistance-game :deep(.lab-controls) { max-height: none; }
.resistance-game :deep(.lab-demonstration), .resistance-game :deep(.lab-controls) { width: 100%; }
.resistance-game :deep(.lab-playback) { display: none; }
.game-stage { padding: 24px; color: #e5f3ed; }
.target-row { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
.small-label { font-size: 13px; color: #a6beb9; }
.target { font-size: 66px; font-weight: 650; letter-spacing: -3px; line-height: 1.2; }
.target small { font-size: 30px; color: #83d6b7; }
.question-counter { text-align: right; line-height: 1.9; font-size: 14px; }
.question-counter span, .stage-instruction { color: #a6beb9; font-size: 13px; }
.stage-instruction { margin: 16px 0 12px; }
.circuit-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.circuit-grid.single { grid-template-columns: minmax(0, 1fr); }
.circuit-card { min-width: 0; border: 2px solid #304954; background: #142936; border-radius: 12px; color: #deeee8; padding: 14px; text-align: left; }
.circuit-card :deep(.circuit) { height: 120px; }
.circuit-card.combined :deep(.circuit) { height: 180px; }
.circuit-card.selected { border-color: #89e2be; background: #193d44; box-shadow: 0 0 0 2px #89e2be20; }
.circuit-card:disabled { cursor: default; }
.card-meta { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; }
.card-meta span { color: #a6beb9; }
.selection-indicator { display: block; text-align: center; font-size: 12px; color: #abd4c3; margin-top: 8px; }
.game-result { margin-top: 20px; padding: 14px; border-radius: 8px; background: #ffffff08; color: #becfca; font-size: 14px; line-height: 1.7; }
.game-result.success { background: #267568; color: white; }
.game-actions { display: grid; grid-template-columns: 1.25fr 1.25fr 1fr 1fr; gap: 12px; margin-top: 16px; }
.game-actions .lab-button { min-height: 52px; padding: 14px 12px; font-size: 16px; font-weight: 600; }
.game-actions .lab-button:not(.primary) { background: #203541; border-color: #48616c; color: #deeee8; }
.game-actions .lab-button:not(.primary):hover { background: #2b4653; }
.game-actions .lab-button.primary { background: #8ae0bb; border-color: #8ae0bb; color: #12382e; }
.game-actions .lab-button.primary:hover { background: #a4edcd; }
.formula-note, .calculation { font-size: 13px; line-height: 1.8; }
.game-controls { display: grid; gap: 14px; }
.game-controls p { margin: 0; font-size: 13px; line-height: 1.8; }
.difficulty, .question-picker { display: flex; gap: 8px; flex-wrap: wrap; }
[aria-pressed="true"].lab-button { background: #e0eee5; border-color: #267568; }
.progress-note { color: #637a70; }
.rules { border-top: 1px solid var(--border); padding-top: 14px; }
.rules h2 { font-size: 14px; margin: 0 0 8px; }
.rules p + p { margin-top: 8px; }
.hint-box, .answer-box { padding: 12px; border-radius: 8px; background: #edf4ee; font-size: 12px; overflow-wrap: anywhere; }
.answer-box .circuit { background: #142936; border-radius: 6px; }
ol { padding-left: 20px; margin: 8px 0; } li { margin-bottom: 12px; line-height: 1.8; }
.answer-button { background: transparent; text-decoration: underline; color: #47695d; font-size: 13px; padding: 6px; }
@media (max-width: 600px) { .game-stage { padding: 16px; } .circuit-grid { gap: 10px; } .circuit-card { padding: 10px; } .circuit-card.combined { grid-column: 1 / -1; } .target { font-size: 54px; } .game-actions { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; } }
</style>
