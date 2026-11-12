<script lang="ts">
  import { session, displayName, signOut } from '../lib/session.svelte'
  import Card from '../lib/ui/Card.svelte'
  import Button from '../lib/ui/Button.svelte'
  let theme = $state(document.documentElement.dataset.theme ?? 'auto')
  function setTheme(t: string) { theme = t; if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t; try { localStorage.setItem('pm2-theme', t) } catch {} }
</script>

<div class="stack">
  <h1>You</h1>
  <Card>
    <div class="stack">
      <h2>{displayName(session.user)}</h2>
      <p class="muted">Signed in with the same account as the current PolyMath.</p>
      <div><Button kind="plain" onclick={() => signOut()}>Sign out</Button></div>
    </div>
  </Card>
  <Card>
    <div class="stack">
      <h2>Appearance</h2>
      <div class="row" role="radiogroup" aria-label="Theme">
        {#each [['auto', 'Match device'], ['light', 'Light'], ['dark', 'Dark']] as [id, name]}
          <button role="radio" aria-checked={theme === id} class:on={theme === id} onclick={() => setTheme(id)}>{name}</button>
        {/each}
      </div>
    </div>
  </Card>
</div>

<style>
  .row button{min-height:44px;padding:0 18px;border-radius:999px;border:2px solid var(--line);background:var(--surface);font-weight:700}
  .row button.on{border-color:var(--ink)}
</style>
