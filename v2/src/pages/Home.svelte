<script lang="ts">
  import { session, displayName } from '../lib/session.svelte'
  import { loadAll } from '../lib/memory/store'
  import { counts, nextUp, type Counts } from '../lib/memory/scheduler'
  import { books, v1Books, leaderboard, inkOn, type Book, type Leader } from '../lib/data'
  import { go } from '../lib/router.svelte'
  import Card from '../lib/ui/Card.svelte'
  import Button from '../lib/ui/Button.svelte'
  import Bar from '../lib/ui/Bar.svelte'

  let phase = $state<'loading' | 'ready' | 'error'>('loading')
  let c = $state<Counts>({ due: 0, fresh: 0, learned: 0 })
  let mine = $state<Book[]>([]), old = $state(0), board = $state<Leader[]>([]), pick = $state(0)
  const cur = $derived(mine[pick])
  const tone = $derived(cur?.tone ?? '#3d63f5')
  const ahead = $derived.by(() => { const i = board.findIndex((r) => r.mine); return i > 0 ? { name: board[i - 1].name, gap: board[i - 1].rating - board[i].rating } : null })

  $effect(() => {
    Promise.all([loadAll(), books(), v1Books(), leaderboard()]).then(([m, b, v, l]) => {
      c = counts(m.items, m.mem, Date.now()); mine = b; old = v.filter((w) => !b.some((x) => x.v1Id === w.id)).length; board = l
      void nextUp; phase = 'ready'
    }).catch(() => { phase = 'error' })
  })
</script>

<div class="home" style="--tone:{tone};--tone-ink:{inkOn(tone)}">
  <h1>Welcome back{displayName(session.user) ? ', ' + displayName(session.user) : ''}</h1>
  {#if phase === 'loading'}<p class="muted">Loading your work</p>
  {:else if phase === 'error'}<p class="muted">Couldn't load your work. Check your connection and reload.</p>
  {:else}
    <div class="grid">
      <Card>
        <div class="stack">
          <span class="label">Up next</span>
          {#if c.due}
            <h2>{c.due} review{c.due > 1 ? 's' : ''} due</h2>
            <p class="muted">Things you learned that are about to fade. Clearing them first keeps everything else sticking.</p>
            <Button kind="tone" onclick={() => go('drill')}>Review now</Button>
          {:else if c.fresh}
            <h2>{c.fresh} new thing{c.fresh > 1 ? 's' : ''} to learn</h2>
            <p class="muted">Nothing is due. Open something new.</p>
            <Button kind="tone" onclick={() => go('study')}>Start</Button>
          {:else if old}
            <h2>Bring your books over</h2>
            <p class="muted">You have {old} book{old > 1 ? 's' : ''} from the current PolyMath. Bring them into the new version to keep going.</p>
            <Button kind="tone" onclick={() => go('study')}>Go to Study</Button>
          {:else if !mine.length}
            <h2>Add your first book</h2>
            <p class="muted">Upload a textbook PDF. PolyMath splits it into lessons and quizzes you as you read.</p>
            <Button kind="tone" onclick={() => go('study')}>Go to Study</Button>
          {:else}
            <h2>All caught up</h2>
            <p class="muted">Nothing is due and nothing new is waiting. Lessons and questions for your books arrive with the next update.</p>
          {/if}
        </div>
      </Card>

      {#if mine.length}
        <Card>
          <div class="stack">
            <div class="tabs" role="tablist" aria-label="Your books">
              {#each mine as b, i}
                <button role="tab" aria-selected={i === pick} aria-label={b.title} class:on={i === pick} style="--t:{b.tone}" onmouseenter={() => (pick = i)} onfocus={() => (pick = i)} onclick={() => (pick = i)}></button>
              {/each}
            </div>
            <h2>{cur.title}</h2>
            <span class="label">{cur.subject ?? 'Book'}{cur.pages ? ' · ' + cur.pages + ' pages' : ''}</span>
            <Bar value={0} />
            <Button kind="tone" onclick={() => go('study')}>Open</Button>
          </div>
        </Card>
      {/if}

      {#if ahead}
        <Card>
          <div class="stack">
            <span class="label">Rival</span>
            <h2 class="num">{ahead.gap.toFixed(1)} IQ behind {ahead.name}</h2>
            <Button kind="plain" onclick={() => go('compete')}>See the leaderboard</Button>
          </div>
        </Card>
      {/if}
    </div>
  {/if}
</div>

<style>
  .home{display:flex;flex-direction:column;gap:24px}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px;align-items:start}
  .tabs{display:flex;gap:10px;flex-wrap:wrap}
  .tabs button{width:36px;height:36px;border-radius:12px;border:2px solid transparent;background:color-mix(in srgb,var(--t) 30%,var(--sunken));transition:all .15s}
  .tabs button.on{background:var(--t);transform:scale(1.15)}
</style>
