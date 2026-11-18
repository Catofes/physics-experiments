<script setup>
import { onMounted, onUnmounted, ref } from "vue";
import ExperimentLayout from "../../components/ExperimentLayout.vue";
import { mountWaveInterference } from "./simulation.js";
import "./experiment.css";

defineProps({ experiment: { type: Object, required: true } });
const root = ref(null);
let simulation;

onMounted(() => {
  simulation = mountWaveInterference(root.value);
});
onUnmounted(() => simulation?.dispose());
</script>

<template>
  <ExperimentLayout :experiment="experiment" @hide="simulation?.pause()">
    <template #content>
      <div ref="root" class="wave-interference">
        <main class="interference-content">
          <nav class="mode-tabs" aria-label="仿真模式">
            <button class="tab active" data-mode="1d" aria-pressed="true">
              一维叠加
            </button>
            <button class="tab" data-mode="2d" aria-pressed="false">
              二维水波
            </button>
          </nav>
          <section class="hero-strip">
            <div class="intro">
              <h2 id="heroTitle">两列波相遇后，各自去哪了？</h2>
              <p id="heroText">
                拖动观察点，比较红、青两列波与紫色合成波。波只是暂时叠加；相遇后仍保持各自的频率、振幅与传播方向。
              </p>
            </div>
            <aside class="condition-card" id="conditionCard">
              <div class="condition-title">
                <span>能否形成稳定干涉图样？</span
                ><span class="condition-badge" id="conditionBadge">可以</span>
              </div>
              <p id="conditionExplain">
                f₁ =
                f₂，相位差不随时间改变。空间中振动始终加强或减弱的位置固定。
              </p>
            </aside>
          </section>

          <p class="layout-tip">
            拖动中间竖栏调整两图大小 · 拖动右侧横栏调整振动图与控制台高度
          </p>
          <div class="lab-grid" id="labGrid">
            <div class="left-column">
              <section class="panel stage-panel">
                <div class="stage-head">
                  <div class="legend">
                    <label class="legend-item" style="color: var(--wave1)"
                      ><input id="mainWave1" type="checkbox" checked />S₁
                      波</label
                    >
                    <label class="legend-item" style="color: var(--wave2)"
                      ><input id="mainWave2" type="checkbox" checked />S₂
                      波</label
                    >
                    <label
                      class="legend-item only-1d"
                      id="sumLegend"
                      style="color: var(--sum)"
                      ><input
                        id="showSum"
                        type="checkbox"
                        checked
                      />合成波</label
                    >
                    <label class="legend-item only-1d"
                      ><input
                        id="showFront"
                        type="checkbox"
                        checked
                      />传播前沿</label
                    >
                    <label class="legend-item only-2d"
                      ><input
                        id="showRings"
                        type="checkbox"
                        checked
                      />同心波面</label
                    >
                    <label class="legend-item only-2d" style="color: var(--sum)"
                      ><input id="showField" type="checkbox" />合成水面</label
                    >
                    <label class="legend-item only-2d" style="color: #13896c"
                      ><input
                        id="showAntinodes"
                        type="checkbox"
                        checked
                      />加强线</label
                    >
                    <label class="legend-item only-2d" style="color: #7650bc"
                      ><input
                        id="showNodes"
                        type="checkbox"
                        checked
                      />减弱线</label
                    >
                    <label class="legend-item"
                      ><input
                        id="showGrid"
                        type="checkbox"
                        checked
                      />网格刻度</label
                    >
                  </div>
                  <div class="formula-chip" id="formulaChip">
                    y = y₁ + y₂　·　v = λf
                  </div>
                </div>
                <div class="canvas-wrap">
                  <canvas id="mainCanvas" aria-label="机械波干涉动画"></canvas>
                  <div class="canvas-hint" id="canvasHint">
                    单击或拖动横轴，选择观察点 P
                  </div>
                </div>
                <div class="playbar">
                  <button
                    class="primary-btn"
                    id="playBtn"
                    aria-label="播放或暂停"
                  >
                    <span id="playIcon">▶</span><span id="playText">播放</span>
                  </button>
                  <button
                    class="icon-btn"
                    id="stepBack"
                    title="后退一步"
                    aria-label="后退一步"
                  >
                    ←
                  </button>
                  <button
                    class="icon-btn"
                    id="stepForward"
                    title="前进一步"
                    aria-label="前进一步"
                  >
                    →
                  </button>
                  <button
                    class="icon-btn"
                    id="resetBtn"
                    title="重置时间"
                    aria-label="重置时间"
                  >
                    ↺
                  </button>
                  <label class="playback-rate"
                    >播放速率<select
                      id="playbackRate"
                      aria-label="动画播放速率"
                    >
                      <option value="0.25">0.25×</option>
                      <option value="0.5">0.5×</option>
                      <option value="1" selected>1×</option>
                      <option value="1.5">1.5×</option>
                      <option value="2">2×</option>
                      <option value="3">3×</option>
                      <option value="4">4×</option>
                    </select></label
                  >
                  <div class="timeline-block">
                    <div class="time-row">
                      <span>实验时间</span><b id="timeOut">0.00 s</b>
                    </div>
                    <input
                      id="timeSlider"
                      type="range"
                      min="0"
                      max="20"
                      step="0.01"
                      value="0"
                      aria-label="实验时间"
                    />
                  </div>
                  <div class="key-hint">
                    <kbd>Space</kbd>播放　<kbd>←</kbd><kbd>→</kbd>逐帧
                  </div>
                </div>
                <div
                  class="splitter splitter-horizontal stage-height-handle"
                  id="stageHeightHandle"
                  role="separator"
                  tabindex="0"
                  aria-label="调整干涉图高度"
                  aria-orientation="horizontal"
                  title="上下拖动调整干涉图高度，双击恢复比例"
                ></div>
                <div class="point-controls">
                  <label
                    >P 点 x / m<input
                      id="pointX"
                      type="number"
                      min="-6"
                      max="6"
                      step="0.01"
                      value="0.00"
                  /></label>
                  <label class="only-2d"
                    >P 点 y / m<input
                      id="pointY"
                      type="number"
                      min="-6.5"
                      max="6.5"
                      step="0.01"
                      value="0.00"
                  /></label>
                  <label class="only-2d"
                    >选点方式<select id="pointMode">
                      <option value="free">自由选点（0.01 m）</option>
                      <option value="constructive">沿加强双曲线</option>
                      <option value="destructive">沿减弱双曲线</option>
                    </select></label
                  >
                  <label class="only-2d"
                    >选择曲线<select id="curveSelect" disabled></select
                  ></label>
                  <span class="point-summary" id="pointSummary"
                    >P (0.00, 0.00) m</span
                  >
                </div>
                <div class="curve-legend only-2d" id="curveLegend">
                  绿色实线：加强线 ·
                  紫色虚线：减弱线（理论轨迹，波到达后形成干涉）
                </div>
              </section>

              <section class="panel insight-panel">
                <div class="panel-title">
                  <div>
                    <h3>干涉诊断</h3>
                    <p>把“看见的图样”还原成物理量</p>
                  </div>
                </div>
                <div class="delta-box">
                  <div class="metric">
                    <small>路程差 Δr</small
                    ><strong id="pathDiff">0.00 m</strong>
                  </div>
                  <div class="metric">
                    <small>频率差 |Δf|</small
                    ><strong id="freqDiff">0.00 Hz</strong>
                  </div>
                  <div class="metric">
                    <small>拍周期</small><strong id="beatPeriod">—</strong>
                  </div>
                </div>
                <div class="verdict">
                  <strong id="pointVerdict">此处如何叠加？</strong>
                  <p id="verdictText">
                    拖动图中的 P
                    点，系统会根据路程差与相位差判断该处的振动状态。
                  </p>
                </div>
                <div class="teacher-note">
                  <span class="challenge">想一想：</span
                  ><span id="challengeText"
                    >“发生叠加”与“形成稳定干涉图样”是一回事吗？把 f₂
                    略微调大，观察结论。</span
                  >
                </div>
              </section>
            </div>

            <div
              class="splitter splitter-vertical"
              id="columnSplitter"
              role="separator"
              tabindex="0"
              aria-label="调整干涉图与振动图宽度"
              aria-orientation="vertical"
              aria-valuemin="30"
              aria-valuemax="72"
              aria-valuenow="59"
            ></div>

            <div class="right-column" id="rightColumn">
              <section class="panel trace-panel">
                <div class="panel-title">
                  <div class="trace-heading">
                    <h3>观察点 P 的振动</h3>
                    <p id="pointLabel">P (0.00, 0.00) m · 从 t = 0 开始记录</p>
                  </div>
                </div>
                <div class="plot-toggles" aria-label="选择振动图曲线">
                  <label style="color: var(--wave1)"
                    ><input id="trace1" type="checkbox" checked />S₁
                    引起的振动</label
                  >
                  <label style="color: var(--wave2)"
                    ><input id="trace2" type="checkbox" checked />S₂
                    引起的振动</label
                  >
                  <label style="color: var(--sum)"
                    ><input
                      id="traceSum"
                      type="checkbox"
                      checked
                    />合振动</label
                  >
                </div>
                <div class="trace-plot">
                  <canvas
                    id="traceCanvas"
                    aria-label="观察点的振动时间图像"
                  ></canvas>
                </div>
                <p class="trace-note" id="arrivalNote">
                  波尚未到达 P：暂不绘制振动曲线。
                </p>
              </section>
              <div
                class="splitter splitter-horizontal"
                id="rowSplitter"
                role="separator"
                tabindex="0"
                aria-label="调整振动图与控制台高度"
                aria-orientation="horizontal"
                aria-valuemin="29"
                aria-valuemax="74"
                aria-valuenow="44"
              ></div>

              <aside class="panel controls">
                <h2>实验控制台</h2>
                <div class="sub">
                  改变频率时留意波长：同一介质中，两列波共享同一个波速。
                </div>

                <section class="control-section">
                  <div class="section-title"><span>一键课堂情境</span></div>
                  <div class="preset-grid">
                    <button class="preset" data-preset="stable">
                      <strong>稳定干涉</strong>同频、同幅、同相
                    </button>
                    <button class="preset" data-preset="beat">
                      <strong>频率不同</strong>图样漂移与拍
                    </button>
                    <button class="preset" data-preset="unequal">
                      <strong>不等振幅</strong>减弱处不为零
                    </button>
                    <button class="preset" data-preset="antiphase">
                      <strong>反相波源</strong>中央由强变弱
                    </button>
                  </div>
                </section>

                <section class="control-section">
                  <div class="section-title"><span>介质</span></div>
                  <div class="fixed-medium">
                    <div class="row">
                      <div>
                        <strong>均匀介质</strong
                        ><small>两列波的传播速度始终相同</small>
                      </div>
                    </div>
                    <div class="range-row">
                      <div class="range-label">
                        <label for="speed">波速 v（换介质时调节）</label
                        ><output id="speedOut">2.40 m/s</output>
                      </div>
                      <input
                        id="speed"
                        type="range"
                        min="1.2"
                        max="4"
                        step="0.1"
                        value="2.4"
                      />
                    </div>
                  </div>
                </section>

                <section class="control-section">
                  <div class="section-title"><span>两个波源</span></div>
                  <div class="source-card">
                    <div class="source-head">
                      <i
                        class="source-swatch"
                        style="background: var(--wave1)"
                      ></i
                      >波源 S₁
                      <span class="lambda" id="lambda1">λ₁ = 2.00 m</span>
                    </div>
                    <div class="two-col">
                      <div class="range-row">
                        <div class="range-label">
                          <label for="f1">频率 f₁</label
                          ><output id="f1Out">1.20 Hz</output>
                        </div>
                        <input
                          id="f1"
                          type="range"
                          min="0.4"
                          max="2.4"
                          step="0.05"
                          value="1.2"
                        />
                      </div>
                      <div class="range-row">
                        <div class="range-label">
                          <label for="a1">振幅 A₁</label
                          ><output id="a1Out">0.70</output>
                        </div>
                        <input
                          id="a1"
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value="0.7"
                        />
                      </div>
                    </div>
                  </div>
                  <div class="source-card">
                    <div class="source-head">
                      <i
                        class="source-swatch"
                        style="background: var(--wave2)"
                      ></i
                      >波源 S₂
                      <span class="lambda" id="lambda2">λ₂ = 2.00 m</span>
                    </div>
                    <div class="two-col">
                      <div class="range-row">
                        <div class="range-label">
                          <label for="f2">频率 f₂</label
                          ><output id="f2Out">1.20 Hz</output>
                        </div>
                        <input
                          id="f2"
                          type="range"
                          min="0.4"
                          max="2.4"
                          step="0.05"
                          value="1.2"
                        />
                      </div>
                      <div class="range-row">
                        <div class="range-label">
                          <label for="a2">振幅 A₂</label
                          ><output id="a2Out">0.70</output>
                        </div>
                        <input
                          id="a2"
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value="0.7"
                        />
                      </div>
                    </div>
                  </div>
                  <div class="range-row">
                    <div class="range-label">
                      <label for="phase">S₂ 初相位 φ₂</label
                      ><output id="phaseOut">0°</output>
                    </div>
                    <input
                      id="phase"
                      type="range"
                      min="0"
                      max="360"
                      step="15"
                      value="0"
                    />
                  </div>
                  <div class="range-row only-2d">
                    <div class="range-label">
                      <label for="distance">波源间距 d</label
                      ><output id="distanceOut">5.0 m</output>
                    </div>
                    <input
                      id="distance"
                      type="range"
                      min="2"
                      max="8"
                      step="0.2"
                      value="5"
                    />
                  </div>
                </section>
              </aside>
              <div
                class="splitter splitter-horizontal"
                id="consoleHeightHandle"
                role="separator"
                tabindex="0"
                aria-label="上下拖动调整实验控制台长度"
                aria-orientation="horizontal"
                title="上下拖动调整控制台长度；双击恢复默认布局"
              ></div>
            </div>
          </div>

          <footer>
            <span>模型：线性小振幅波 · 理想均匀介质 · 忽略衰减与边界反射</span
            ><span>波速关系 v = λf ｜ 稳定干涉：同频 + 相位差恒定</span>
          </footer>
        </main>
      </div>
    </template>
  </ExperimentLayout>
</template>
