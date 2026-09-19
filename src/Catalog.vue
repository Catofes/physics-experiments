<script setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import experiments from "./experiments.json";
const version = __APP_VERSION__;
const route = useRoute(),
  router = useRouter();
const categories = [
  "全部",
  ...new Set(experiments.map((item) => item.category)),
];
const search = computed({
  get: () => (typeof route.query.q === "string" ? route.query.q : ""),
  set: (q) => router.replace({ query: { ...route.query, q: q || undefined } }),
});
const category = computed({
  get: () =>
    categories.includes(route.query.category) ? route.query.category : "全部",
  set: (category) =>
    router.replace({
      query: {
        ...route.query,
        category: category === "全部" ? undefined : category,
      },
    }),
});
const matches = computed(() =>
  experiments.filter(
    (item) =>
      (category.value === "全部" || item.category === category.value) &&
      [item.title, item.description, ...item.tags]
        .join(" ")
        .toLocaleLowerCase()
        .includes(search.value.trim().toLocaleLowerCase()),
  ),
);
const covers = import.meta.glob("./covers/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
});
</script>
<template>
  <a class="skip-link" href="#catalog">跳转到实验目录</a>
  <header class="site-header">
    <RouterLink class="brand" to="/" aria-label="物理实验室首页"
      ><span class="brand-mark" aria-hidden="true">φ</span
      ><span>物理实验室<small>高中物理 · 课堂交互演示</small></span></RouterLink
    >
    <span class="header-note">观察 · 调节 · 理解</span>
  </header>
  <main class="page">
    <section class="intro" aria-labelledby="intro-title">
      <div>
        <p class="eyebrow">让每一个物理过程，看得见</p>
        <h1 id="intro-title">把物理，<span>放到眼前。</span></h1>
        <p class="intro-copy">
          从抽象的规律，到直观的变化。<br />选择一个实验，和学生一起观察、提问、探索。
        </p>
      </div>
      <div class="intro-note">
        <span class="note-orbit" aria-hidden="true">↗</span>
        <p>一个问题，<br />一次亲眼看见的发现。</p>
        <span>为课堂演示而准备</span>
      </div>
    </section>
    <section id="catalog" aria-labelledby="catalog-title">
      <div class="catalog-heading">
        <div>
          <p class="eyebrow">EXPLORE / 实验目录</p>
          <h2 id="catalog-title">今天，探索什么？</h2>
        </div>
        <label class="search">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
          >
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m15.5 15.5 5 5" />
          </svg>
          <input
            id="search"
            v-model="search"
            type="search"
            placeholder="搜索实验、知识点…"
            aria-label="搜索实验或知识点"
            autocomplete="off"
        /></label>
      </div>
      <div class="catalog-tools">
        <div
          id="categories"
          class="filters"
          role="group"
          aria-label="按学科分类"
        >
          <button
            v-for="name in categories"
            :key="name"
            class="filter"
            :aria-pressed="category === name"
            @click="category = name"
          >
            {{ name }}
          </button>
        </div>
        <p id="result-count" class="result-count" role="status">
          共 {{ matches.length }} 个实验
        </p>
      </div>
      <div id="experiment-grid" class="experiment-grid">
        <RouterLink
          v-for="item in matches"
          :key="item.id"
          class="experiment-card"
          :to="{
            name: 'experiment',
            params: { id: item.id },
            query: route.query,
          }"
        >
          <div class="card-cover">
            <img
              class="cover-image"
              :src="
                covers['./covers/' + item.id + '.svg'] ||
                covers['./covers/default.svg']
              "
              alt=""
              width="600"
              height="280"
            /><span class="category-badge">{{ item.category }}</span>
          </div>
          <div class="card-body">
            <div class="card-heading">
              <h3>{{ item.title }}</h3>
              <span class="card-arrow">↗</span>
            </div>
            <p class="card-description">{{ item.description }}</p>
            <div class="tags">
              <span v-for="tag in item.tags" :key="tag" class="tag">{{
                tag
              }}</span>
            </div>
          </div>
          <div class="card-foot">
            <span>交互演示</span><span class="card-start">进入实验 →</span>
          </div>
        </RouterLink>
      </div>
      <div id="empty" class="empty" v-if="!matches.length">
        <h3>没有找到相关实验</h3>
        <p>试试其他关键词，或查看全部实验。</p>
        <button
          id="reset-search"
          class="button"
          @click="router.replace({ query: {} })"
        >
          查看全部实验
        </button>
      </div>
    </section>
    <div class="classroom-note">
      <span aria-hidden="true">↗</span>
      <p>
        <strong>让演示跟着课堂走</strong
        ><span>进入实验后可全屏展示，留更多空间给观察与讨论。</span>
      </p>
    </div>
  </main>
  <footer class="site-footer">
    <span>物理实验室 · v{{ version }}</span
    ><span>在观察中发现，在探索中理解。</span>
  </footer>
</template>
