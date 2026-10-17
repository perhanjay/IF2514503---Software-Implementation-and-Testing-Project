import { defineStore } from 'pinia';
import axios from 'axios';

const initialToken = localStorage.getItem('polaris_token');
if (initialToken) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${initialToken}`;
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: JSON.parse(localStorage.getItem('polaris_user') || 'null'),
    token: initialToken || null,
    walletBalance: Number(localStorage.getItem('polaris_wallet_balance') || 0),
  }),
  getters: {
    isAuthenticated: (state) => !!state.token,
    isGuest: (state) => !state.user || state.user?.isGuest === true || state.user?.email === 'guest@polaris.audio',
  },
  actions: {
    setAuth(user, token, balance) {
      this.user = user;
      this.token = token;
      this.walletBalance = balance;
      localStorage.setItem('polaris_user', JSON.stringify(user));
      localStorage.setItem('polaris_token', token);
      localStorage.setItem('polaris_wallet_balance', String(balance));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    },
    updateBalance(newBalance) {
      this.walletBalance = newBalance;
      localStorage.setItem('polaris_wallet_balance', String(newBalance));
    },
    logout() {
      this.user = null;
      this.token = null;
      this.walletBalance = 0;
      localStorage.removeItem('polaris_user');
      localStorage.removeItem('polaris_token');
      localStorage.removeItem('polaris_wallet_balance');
      delete axios.defaults.headers.common['Authorization'];
    },
    async fetchMe() {
      if (!this.token) return;
      try {
        axios.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
        const res = await axios.get('/api/v1/auth/me');
        this.user = res.data.user;
        this.walletBalance = res.data.wallet.balance;
      } catch (err) {
        if (err.response?.status === 401) {
          this.logout();
        }
      }
    }
  }
});
