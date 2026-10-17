import { createRouter, createWebHistory } from 'vue-router';
import LandingView from '../views/LandingView.vue';
import LoginView from '../views/LoginView.vue';
import RegisterView from '../views/RegisterView.vue';
import DashboardView from '../views/DashboardView.vue';

const routes = [
  { path: '/', component: LandingView },
  { path: '/login', component: LoginView },
  { path: '/register', component: RegisterView },
  { path: '/dashboard', component: DashboardView },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('polaris_token');
  const user = JSON.parse(localStorage.getItem('polaris_user') || 'null');
  const isGuest = !user || user.isGuest || user.email === 'guest@polaris.audio';

  // If already authenticated with a real permanent account, avoid login/register forms
  if ((to.path === '/login' || to.path === '/register') && token && !isGuest) {
    next('/dashboard');
  } else {
    next();
  }
});

export default router;

