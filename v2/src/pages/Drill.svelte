<script lang="ts">
  import { loadAll } from '../lib/memory/store'
  import { counts, type Counts } from '../lib/memory/scheduler'
  import Card from '../lib/ui/Card.svelte'
  let c = $state<Counts | null>(null), failed = $state(false)
  $effect(() => { loadAll().then((m) => { c = counts(m.items, m.mem, Date.now()) }).catch(() => { failed = true }) })
</script>

<div class="stack">
  <div><h1>Drill</h1><p class="muted">One practice mode for everything: your books, SAT, ASVAB, MCAT, Bar and AP Calc. It picks what you most need next.</p></div>
  <Card>
    <div class="stack">
      {#if failed}<p class="muted">Couldn't load your practice queue. Reload to try again.</p>
      {:else if !c}<p class="muted">Loading your queue</p>
      {:else}
        <div class="stats">
          <div><b class="num">{c.due}</b><span class="muted">due now</span></div>
          <div><b class="num">{c.fresh}</b><span class="muted">new</span></div>
          <div><b class="num">{c.learned}</b><span class="muted">learned</span></div>
        </div>
        <p class="muted">Questions arrive here once books and question banks are processed in this version. Until then, practice on the current PolyMath site.</p>
      {/if}
    </div>
  </Card>
</div>

<style>.stats{display:flex;gap:40px;flex-wrap:wrap}.stats div{display:flex;flex-direction:column}.stats b{font-weight:800;font-size:40px;line-height:1}</style>
