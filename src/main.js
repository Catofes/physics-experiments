import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
import Catalog from "./Catalog.vue";
import Experiment from "./views/Experiment.vue";
import NotFound from "./views/NotFound.vue";
import "./site.css";
import "./lab.css";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "catalog", component: Catalog },
    { path: "/experiments/:id", name: "experiment", component: Experiment },
    { path: "/:pathMatch(.*)*", component: NotFound },
  ],
  scrollBehavior(to, from, saved) {
    if (saved) return saved;
    if (to.path === from.path) return false;
    return { top: 0 };
  },
});
createApp(App).use(router).mount("#app");
