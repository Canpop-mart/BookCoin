import { createRouter, createWebHistory } from 'vue-router';
import { store } from './store';
import LoginView from './views/LoginView.vue';
import HomeView from './views/HomeView.vue';
import ReadingView from './views/ReadingView.vue';
import LogView from './views/LogView.vue';
import NookView from './views/NookView.vue';
import ProfileView from './views/ProfileView.vue';

const routes = [
  { path: '/login', component: LoginView, meta: { public: true } },
  { path: '/', component: HomeView },
  { path: '/reading', component: ReadingView, meta: { full: true } },
  { path: '/log', component: LogView, meta: { full: true } },
  { path: '/nook', component: NookView },
  { path: '/profile/:id?', component: ProfileView },
];

const router = createRouter({ history: createWebHistory(), routes });

router.beforeEach((to) => {
  if (!to.meta.public && !store.token) return '/login';
  if (to.path === '/login' && store.token) return '/';
});

export default router;
