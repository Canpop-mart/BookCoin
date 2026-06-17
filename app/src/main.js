import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import Mascot from './components/Mascot.vue';
import './styles.css';

const app = createApp(App);
app.component('Mascot', Mascot);
app.use(router).mount('#app');
