<script lang="ts">
  import { signIn, signUp } from '../lib/session.svelte'
  import Button from '../lib/ui/Button.svelte'
  let mode = $state<'in' | 'up'>('in')
  let name = $state(''), pw = $state(''), err = $state(''), busy = $state(false)
  async function submit(e: Event) {
    e.preventDefault(); err = ''; busy = true
    try { await (mode === 'in' ? signIn(name, pw) : signUp(name, pw)) } catch (x) { err = (x as Error).message } finally { busy = false }
  }
</script>

<div class="wrap">
  <form onsubmit={submit}>
    <img src="/logo.png" alt="" />
    <h1>{mode === 'in' ? 'Sign in' : 'Create your account'}</h1>
    <p class="muted">{mode === 'in' ? 'Use your PolyMath username or email. Your books and IQ come with you.' : 'Pick a username. No email needed.'}</p>
    <label>Username{mode === 'in' ? ' or email' : ''}<input bind:value={name} autocomplete="username" autocapitalize="none" required /></label>
    <label>Password<input bind:value={pw} type="password" autocomplete={mode === 'in' ? 'current-password' : 'new-password'} minlength="8" required /></label>
    {#if err}<p class="err" role="alert">{err}</p>{/if}
    <Button type="submit" disabled={busy}>{busy ? 'One moment' : mode === 'in' ? 'Sign in' : 'Create account'}</Button>
    <button type="button" class="swap" onclick={() => { mode = mode === 'in' ? 'up' : 'in'; err = '' }}>{mode === 'in' ? 'New here? Create an account' : 'Have an account? Sign in'}</button>
  </form>
</div>

<style>
  .wrap{min-height:100vh;display:grid;place-items:center;padding:24px}
  form{width:100%;max-width:400px;display:flex;flex-direction:column;gap:14px}
  img{width:72px;height:72px}
  label{display:flex;flex-direction:column;gap:6px;font-weight:700;font-size:14px}
  input{height:50px;padding:0 16px;border:2px solid var(--line);border-radius:var(--r-sm);background:var(--surface);font-weight:500;font-size:16px}
  .err{color:var(--bad);font-weight:600}
  .swap{border:0;background:none;color:var(--muted);font-weight:600;text-decoration:underline;padding:8px}
</style>
