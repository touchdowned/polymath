<script lang="ts">
  import { session } from '../lib/session.svelte'
  import { books, v1Books, importV1, inkOn, type Book } from '../lib/data'
  import Card from '../lib/ui/Card.svelte'
  import Button from '../lib/ui/Button.svelte'

  let list = $state<Book[]>([]), waiting = $state(0), phase = $state<'loading' | 'ready' | 'error'>('loading'), busy = $state(false), note = $state('')
  async function load() {
    try { const [b, v] = await Promise.all([books(), v1Books()]); list = b; waiting = v.filter((w) => !b.some((x) => x.v1Id === w.id)).length; phase = 'ready' } catch { phase = 'error' }
  }
  async function bring() {
    busy = true; note = ''
    try { const n = await importV1(session.user!.id); note = n + ' book' + (n === 1 ? '' : 's') + ' brought over.'; await load() } catch (e) { note = 'That didn\'t work: ' + (e as Error).message } finally { busy = false }
  }
  $effect(() => { load() })
</script>

<div class="stack">
  <div><h1>Study</h1><p class="muted">Your books and notes. Read them as lessons or swipe through them as Shorts.</p></div>
  {#if phase === 'loading'}<p class="muted">Loading your books</p>
  {:else if phase === 'error'}<p class="muted">Couldn't load your books. Reload to try again.</p>
  {:else}
    {#if waiting}
      <Card>
        <div class="stack">
          <h2>{waiting} book{waiting > 1 ? 's' : ''} from the current PolyMath</h2>
          <p class="muted">Bringing them over keeps the same files. Nothing is removed from the current site.</p>
          <div><Button onclick={bring} disabled={busy}>{busy ? 'Bringing them over' : 'Bring them over'}</Button></div>
        </div>
      </Card>
    {/if}
    {#if note}<p role="status">{note}</p>{/if}
    {#if list.length}
      <div class="path">
        {#each list as b, i}
          {#if i}<span class="link" aria-hidden="true"></span>{/if}
          <div class="book" style="--tone:{b.tone ?? '#3d63f5'};--tone-ink:{inkOn(b.tone ?? '#3d63f5')}">
            <span class="chip">{b.title.slice(0, 1).toUpperCase()}</span>
            <span class="main"><small>{b.subject ?? 'Book'}{b.pages ? ' · ' + b.pages + ' pages' : ''}</small><b>{b.title}</b><em>Lessons are being prepared in the next update</em></span>
          </div>
        {/each}
      </div>
    {:else if !waiting}
      <Card><div class="stack"><h2>No books yet</h2><p class="muted">Uploading new books in this version arrives with the next update. For now, add books on the current PolyMath site and bring them over here.</p></div></Card>
    {/if}
  {/if}
</div>

<style>
  .path{display:flex;flex-direction:column;max-width:720px}
  .link{align-self:center;width:4px;height:24px;background:var(--line)}
  .book{display:flex;align-items:center;gap:20px;padding:18px 22px;border:2px solid var(--line);border-bottom-width:6px;border-radius:26px;background:var(--surface)}
  .chip{display:grid;place-items:center;flex:none;width:64px;height:64px;border-radius:20px;background:var(--tone);color:var(--tone-ink);font-weight:800;font-size:26px;box-shadow:0 5px 0 color-mix(in srgb,var(--tone) 68%,#000)}
  .main{display:flex;flex-direction:column;gap:4px;min-width:0}
  small{font-weight:800;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
  b{font-weight:700;font-size:20px;line-height:1.2}
  em{font-style:normal;font-size:14px;color:var(--muted)}
</style>
