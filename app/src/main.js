import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import Mascot from './components/Mascot.vue';
import CoinCount from './components/CoinCount.vue';
import CoinBurst from './components/CoinBurst.vue';
import './styles.css';

const app = createApp(App);
app.component('Mascot', Mascot);
app.component('CoinCount', CoinCount);
app.component('CoinBurst', CoinBurst);
app.use(router).mount('#app');
