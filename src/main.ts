import { mount } from 'svelte';
import App from './App.svelte';
import './styles/tokens.css';
import './styles/global.css';

const target = document.getElementById('app');
if (!target) {
  throw new Error('マウント先の要素 #app が見つかりません。');
}

export default mount(App, { target });
