<script lang="ts">
  import { session, displayName } from '../lib/session.svelte'
  import { profile, leaderboard, type Profile, type Leader } from '../lib/data'
  import Card from '../lib/ui/Card.svelte'
  let me = $state<Profile | null>(null), board = $state<Leader[]>([]), phase = $state<'loading' | 'ready'>('loading')
  $effect(() => { Promise.all([profile(displayName(session.user)), leaderboard(10)]).then(([p, l]) => { me = p; board = l; phase = 'ready' }) })
</script>

<div class="stack">
  <div><h1>Compete</h1><p class="muted">1v1 matches, boss raids and the daily boss, on what you've studied.</p></div>
  {#if phase === 'loading'}<p class="muted">Loading the leaderboard</p>
  {:else}
    <div class="grid">
      <Card>
        <div class="stack">
          <span class="label">Your rank</span>
          {#if me}
            <h2 class="num big">{me.rating.toFixed(1)} IQ</h2>
            <p class="muted">{me.rank ? (/^\d+$/.test(me.rank) ? 'Rank ' + me.rank : me.rank) + ' · ' : ''}{me.wins} wins, {me.losses} losses, {me.draws} draws</p>
          {:else}<p class="muted">Play a match to get ranked.</p>{/if}
          <p class="muted">Matches still run on the current PolyMath site. They move here in a later update, with the same IQ.</p>
        </div>
      </Card>
      <Card>
        <div class="stack">
          <span class="label">Leaderboard</span>
          {#if board.length}
            <ol>{#each board as r, i}<li class:mine={r.mine}><span class="num">{i + 1}</span><b>{r.mine ? 'You' : r.name}</b><span class="num">{r.rating.toFixed(1)}</span></li>{/each}</ol>
          {:else}<p class="muted">No ranked players yet.</p>{/if}
        </div>
      </Card>
    </div>
  {/if}
</div>

<style>
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px;align-items:start}
  .big{font-size:40px}
  ol{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}
  li{display:flex;align-items:center;gap:14px;padding:10px 14px;border-radius:14px}
  li b{flex:1;font-weight:600}li span:first-child{width:20px;color:var(--muted);font-weight:700}
  li.mine{background:var(--accent);color:var(--accent-ink)}li.mine span:first-child{color:inherit}
</style>
