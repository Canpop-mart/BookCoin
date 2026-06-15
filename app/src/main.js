import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import MascotBird from './components/MascotBird.vue';
import './styles.css';

const app = createApp(App);
app.component('MascotBird', MascotBird);
app.use(router).mount('#app');
