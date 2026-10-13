import { createApp } from 'vue';
import { createPinia } from 'pinia';
import router from './router';
import App from './App.vue';
import './style.css';
import axios from 'axios';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);

const token = localStorage.getItem('polaris_token');
if (token) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

app.mount('#app');
