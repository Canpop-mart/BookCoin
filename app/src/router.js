import { createRouter, createWebHistory } from 'vue-router';
import { store } from './store';
import LoginView from './views/LoginView.vue';
import HomeView from './views/HomeView.vue';
import ReadingView from './views/ReadingView.vue';
import LogView from './views/LogView.vue';
import NookView from './views/NookView.vue';
import ProfileView from './views/ProfileView.vue';
import QuestsView from './views/QuestsView.vue';
import ListsView from './views/ListsView.vue';
import ShopView from './views/ShopView.vue';
import AdminView from './views/AdminView.vue';

const routes = [
  { path: '/login', component: LoginView, meta: { public: true } },
  { path: '/', component: HomeView },
  { path: '/reading', component: ReadingView, meta: { full: true } },
  { path: '/log', component: LogView, meta: { full: true } },
  { path: '/quests', component: QuestsView },
  { path: '/lists', component: ListsView },
  { path: '/nook', component: NookView },
  { path: '/shop', component: ShopView },
  { path: '/profile/:id?', component: ProfileView },
  { path: '/admin', component: AdminView, meta: { full: true } },
];

const router = createRouter({ history: createWebHistory(), routes });

router.beforeEach((to) => {
  if (!to.meta.public && !store.token) return '/login';
  if (to.path === '/login' && store.token) return '/';
});

export default router;
