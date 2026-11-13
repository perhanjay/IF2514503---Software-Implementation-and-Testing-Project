import { createRouter, createWebHistory } from 'vue-router';
import LandingView from '../views/LandingView.vue';
import LoginView from '../views/LoginView.vue';
import RegisterView from '../views/RegisterView.vue';
import DashboardView from '../views/DashboardView.vue';
import BillingView from '../views/BillingView.vue';

const routes = [
  { path: '/', component: LandingView },
  { path: '/login', component: LoginView },
  { path: '/register', component: RegisterView },
  { path: '/dashboard', component: DashboardView },
  { path: '/billing', component: BillingView, alias: '/wallet' },
  {
    path: '/admin/users',
    name: 'AdminUsers',
    component: () => import('../views/AdminUsersView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/admin/transactions',
    name: 'AdminTransactions',
    component: () => import('../views/AdminTransactionsView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  { path: '/admin', redirect: '/admin/users' },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('polaris_token');
  const user = JSON.parse(localStorage.getItem('polaris_user') || 'null');
  const isGuest = !user || user.isGuest || user.email === 'guest@polaris.audio';

  if (to.meta.requiresAdmin) {
    if (!token || !user || user.role !== 'ADMIN') {
      return next('/dashboard');
    }
  }

  // If user is ADMIN, prevent access to consumer studio workspace and billing
  if (user && user.role === 'ADMIN') {
    if (to.path === '/dashboard' || to.path.startsWith('/dashboard') || to.path === '/billing' || to.path === '/wallet') {
      return next('/admin/users');
    }
  }

  // If already authenticated with a real permanent account, avoid login/register forms
  if ((to.path === '/login' || to.path === '/register') && token && !isGuest) {
    if (user.role === 'ADMIN') {
      return next('/admin/users');
    }
    return next('/dashboard');
  }

  next();
});

export default router;
