import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import Mascot from './components/Mascot.vue';
import Avatar from './components/Avatar.vue';
import CoinCount from './components/CoinCount.vue';
import CoinBurst from './components/CoinBurst.vue';
import InfoBubble from './components/InfoBubble.vue';
import BookFinder from './components/BookFinder.vue';
import './styles.css';

const app = createApp(App);
app.component('Mascot', Mascot);
app.component('Avatar', Avatar);
app.component('CoinCount', CoinCount);
app.component('CoinBurst', CoinBurst);
app.component('InfoBubble', InfoBubble);
app.component('BookFinder', BookFinder);
app.use(router).mount('#app');
