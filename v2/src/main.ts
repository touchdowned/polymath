import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'

try { const t = localStorage.getItem('pm2-theme'); if (t && t !== 'auto') document.documentElement.dataset.theme = t } catch {}

export default mount(App, { target: document.getElementById('app')! })
