<script setup>
import { onMounted, onUnmounted, ref } from "vue";
import ExperimentLayout from "../../components/ExperimentLayout.vue";
import { mountMechanicalWaves } from "./simulation.js";
import "./experiment.css";

defineProps({ experiment: { type: Object, required: true } });
const root = ref(null);
let simulation;

onMounted(() => {
  simulation = mountMechanicalWaves(root.value);
});
onUnmounted(() => simulation?.dispose());
</script>

<template>
  <ExperimentLayout :experiment="experiment" @hide="simulation?.pause()">
    <template #content>
      <div ref="root" class="mechanical-waves">
        <svg
          class="icons"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
        >
          <symbol id="i-wave" viewBox="0 0 24 24">
            <path
              d="M2 12c3.2 0 2.8-6 5.5-6s2.6 12 5.2 12 2.7-9 5.4-9c1.6 0 2.2 3 3.9 3"
            />
          </symbol>
          <symbol id="i-spring" viewBox="0 0 24 24">
            <path d="M2.5 12h3l2-4 3 8 3-8 2 4h2m0-3h4v6h-4z" />
          </symbol>
          <symbol id="i-pendulum" viewBox="0 0 24 24">
            <path d="M7 4h10m-5 0 5 11M12 7v10" stroke-dasharray="18 0 2 2" />
            <circle cx="18" cy="18" r="3" />
          </symbol>
          <symbol id="i-graph" viewBox="0 0 24 24">
            <path d="M4 4v16h16M7 13c3 0 2-6 5-6s2 8 5 8c1.4 0 1.8-1.6 2.5-3" />
          </symbol>
          <symbol id="i-damped" viewBox="0 0 24 24">
            <path
              d="M3 12h18M3 6c2.8 0 2.6 11 5.4 11s2.3-8 5.1-8 2 5 4.7 5c1.1 0 1.8-1 2.8-1.5"
            />
          </symbol>
          <symbol id="i-long" viewBox="0 0 24 24">
            <path d="M3 8v8m3-10v12m3-11v10m5-8v6m4-8v10m3-11v12" />
          </symbol>
          <symbol id="i-add" viewBox="0 0 24 24">
            <path
              d="M3 8c3 0 3-3 6-3s3 6 6 6 3-3 6-3M3 16c3 0 3 3 6 3s3-6 6-6 3 3 6 3"
            />
          </symbol>
          <symbol id="i-play" viewBox="0 0 24 24">
            <path d="m8 5 12 7-12 7z" fill="currentColor" stroke-width="1.4" />
          </symbol>
          <symbol id="i-pause" viewBox="0 0 24 24">
            <path d="M9 5v14m6-14v14" stroke-width="2.9" />
          </symbol>
          <symbol id="i-reset" viewBox="0 0 24 24">
            <path d="M4 11a8 8 0 1 1 2.7 6M4 5v6h6" />
          </symbol>
          <symbol id="i-prev" viewBox="0 0 24 24">
            <path d="M6 5v14m12-13-9 6 9 6z" />
          </symbol>
          <symbol id="i-next" viewBox="0 0 24 24">
            <path d="M18 5v14M6 6l9 6-9 6z" />
          </symbol>
          <symbol id="i-keys" viewBox="0 0 24 24">
            <rect x="3" y="6" width="18" height="12" rx="2" />
            <path d="M7 10h.1m3.3 0h.1m3.3 0h.1m3.3 0h.1M8 14h8" />
          </symbol>
        </svg>

        <main class="wrap">
          <div class="shell" id="demo-layout">
            <nav class="menu" id="demo-menu" aria-label="演示目录">
              <div class="menu-head">
                <h2>演示目录</h2>
                <div class="menu-actions">
                  <button
                    class="button-outline"
                    id="toggle-menu"
                    type="button"
                    aria-expanded="true"
                    aria-label="隐藏目录"
                    title="隐藏目录"
                  >
                    ‹
                  </button>
                </div>
              </div>
              <div class="nav-group">
                <p class="nav-label">机械振动</p>
                <div class="nav-items">
                  <button
                    class="nav-button"
                    type="button"
                    data-demo="spring"
                    aria-current="true"
                  >
                    <svg class="icon" aria-hidden="true">
                      <use href="#i-spring" /></svg
                    >弹簧振子
                  </button>
                  <button class="nav-button" type="button" data-demo="pendulum">
                    <svg class="icon" aria-hidden="true">
                      <use href="#i-pendulum" /></svg
                    >单摆
                  </button>
                  <button class="nav-button" type="button" data-demo="harmonic">
                    <svg class="icon" aria-hidden="true">
                      <use href="#i-graph" /></svg
                    >简谐振动图像
                  </button>
                  <button class="nav-button" type="button" data-demo="damped">
                    <svg class="icon" aria-hidden="true">
                      <use href="#i-damped" /></svg
                    >阻尼振动图像
                  </button>
                </div>
              </div>
              <div class="nav-group">
                <p class="nav-label">机械波</p>
                <div class="nav-items">
                  <button
                    class="nav-button"
                    type="button"
                    data-demo="transverse"
                  >
                    <svg class="icon" aria-hidden="true">
                      <use href="#i-wave" /></svg
                    >横波
                  </button>
                  <button
                    class="nav-button"
                    type="button"
                    data-demo="longitudinal"
                  >
                    <svg class="icon" aria-hidden="true">
                      <use href="#i-long" /></svg
                    >纵波
                  </button>
                  <button
                    class="nav-button"
                    type="button"
                    data-demo="superposition"
                  >
                    <svg class="icon" aria-hidden="true">
                      <use href="#i-add" /></svg
                    >波的叠加
                  </button>
                </div>
              </div>
            </nav>

            <article class="lesson" aria-labelledby="demo-title">
              <section class="stage-card card" aria-label="动画演示">
                <div class="stage-header">
                  <h2 id="demo-title">弹簧振子</h2>
                  <p id="demo-description">
                    观察水平弹簧振子的运动及各物理量的方向。
                  </p>
                </div>
                <div class="stage">
                  <canvas
                    id="simulation"
                    role="img"
                    aria-label="弹簧振子运动示意图"
                    >动画区需要支持 Canvas 的浏览器。</canvas
                  >
                  <div class="stage-meta">
                    <span class="stage-state" id="play-state" role="status"
                      >已暂停</span
                    >
                    <span class="stage-time" aria-label="演示时间"
                      ><var>t</var> = <span id="elapsed">0.00</span> s</span
                    >
                  </div>
                </div>
                <div class="toolbar" role="group" aria-label="播放控制">
                  <button
                    class="primary"
                    id="play"
                    type="button"
                    title="播放或暂停（空格）"
                  >
                    <svg class="icon" aria-hidden="true">
                      <use href="#i-play" />
                    </svg>
                    <span>播放</span>
                  </button>
                  <button id="reset" type="button" title="回到起始时刻（Home）">
                    <svg class="icon" aria-hidden="true">
                      <use href="#i-reset" />
                    </svg>
                    <span>重置</span>
                  </button>
                  <button
                    class="frame-button"
                    id="previous"
                    type="button"
                    aria-label="上一帧"
                    title="上一帧（←）"
                  >
                    <svg class="icon" aria-hidden="true">
                      <use href="#i-prev" />
                    </svg>
                    <span class="frame-label">上一帧</span>
                  </button>
                  <button
                    class="frame-button frame-next"
                    id="next"
                    type="button"
                    aria-label="下一帧"
                    title="下一帧（→）"
                  >
                    <svg class="icon" aria-hidden="true">
                      <use href="#i-next" />
                    </svg>
                    <span class="frame-label">下一帧</span>
                  </button>
                  <details class="keys">
                    <summary aria-label="快捷键" title="快捷键">
                      <svg class="icon" aria-hidden="true">
                        <use href="#i-keys" /></svg
                      ><span class="keys-label"> 快捷键</span>
                    </summary>
                    <dl class="key-list">
                      <div>
                        <dt><kbd>空格</kbd></dt>
                        <dd>播放或暂停</dd>
                      </div>
                      <div>
                        <dt><kbd>Enter</kbd> <kbd>End</kbd></dt>
                        <dd>播放、暂停</dd>
                      </div>
                      <div>
                        <dt><kbd>←</kbd> <kbd>→</kbd></dt>
                        <dd>逐帧观察</dd>
                      </div>
                      <div>
                        <dt><kbd>Home</kbd></dt>
                        <dd>回到起始位置</dd>
                      </div>
                    </dl>
                  </details>
                </div>
                <div
                  class="splitter"
                  id="splitter"
                  role="separator"
                  aria-label="调整演示区和参数栏宽度"
                  aria-orientation="vertical"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-valuenow="75"
                  tabindex="0"
                  title="拖动调整宽度"
                ></div>
              </section>

              <section class="settings card" aria-labelledby="settings-title">
                <div class="settings-head">
                  <h2 id="settings-title">参数设置</h2>
                  <button class="text-button" id="defaults" type="button">
                    恢复默认
                  </button>
                </div>
                <div id="selectors"></div>
                <div id="parameters"></div>
                <div class="metric" id="metric" hidden>
                  <span id="metric-label"></span>
                  <strong id="metric-value"></strong>
                </div>
                <div id="display-options"></div>
              </section>

              <section
                class="observation card"
                aria-labelledby="observation-title"
              >
                <div>
                  <h3 id="observation-title">观察提示</h3>
                  <p id="observation-text"></p>
                </div>
                <div id="formula" class="formula"></div>
              </section>
            </article>
          </div>
          <footer class="wrap footer">
            原 Flash 课件 · 广东顺德北滘中学 覃进文
          </footer>
        </main>
      </div>
    </template>
  </ExperimentLayout>
</template>
