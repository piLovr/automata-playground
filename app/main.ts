import { mount } from 'svelte';
import './styles/theme.css';
import App from './App.svelte';

const target = document.getElementById('app');
if (!target) {
  throw new Error('Element #app fehlt in index.html');
}

mount(App, { target });
