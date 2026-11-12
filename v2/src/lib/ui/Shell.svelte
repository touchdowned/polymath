<script lang="ts">
  import type { Snippet } from 'svelte'
  import { route, go, type Page } from '../router.svelte'
  let { children }: { children: Snippet } = $props()
  const tabs: { id: Page; name: string; d: string }[] = [
    { id: 'home', name: 'Home', d: 'M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z' },
    { id: 'study', name: 'Study', d: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11' },
    { id: 'drill', name: 'Drill', d: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l3 2M9 2h6' },
    { id: 'compete', name: 'Compete', d: 'M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 14v4M8 20h8' },
    { id: 'you', name: 'You', d: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0' },
  ]
</script>

<div class="shell">
  <header>
    <a class="brand" href="#/home"><img src="/logo.png" alt="" /><span>PolyMath</span></a>
    <nav aria-label="Main">
      {#each tabs as t}
        <button class:on={route.page === t.id} aria-current={route.page === t.id ? 'page' : undefined} onclick={() => go(t.id)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={t.d} /></svg><span>{t.name}</span>
        </button>
      {/each}
    </nav>
  </header>
  <main>{@render children()}</main>
</div>

<style>
  .shell{min-height:100vh;display:flex;flex-direction:column}
  header{display:flex;align-items:center;gap:40px;padding:0 max(24px,calc((100% - 1180px)/2));min-height:76px;border-bottom:1px solid var(--line);background:var(--bg);position:sticky;top:0;z-index:5}
  .brand{display:flex;align-items:center;gap:10px;text-decoration:none;font-weight:800;font-size:24px;letter-spacing:-.03em}
  .brand img{width:36px;height:36px}
  nav{display:flex;gap:28px}
  nav button{display:flex;align-items:center;gap:8px;padding:24px 0 22px;border:0;border-bottom:2px solid transparent;background:none;color:var(--muted);font-weight:600;font-size:17px}
  nav button.on{color:var(--ink);border-bottom-color:var(--ink)}
  nav svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
  main{flex:1;width:100%;max-width:1180px;margin:0 auto;padding:36px 24px 60px}
  @media (max-width:820px){
    header{position:static;min-height:0;padding:12px 16px;border:0}
    .brand{font-size:21px}.brand img{width:30px;height:30px}
    nav{position:fixed;left:12px;right:12px;bottom:calc(10px + env(safe-area-inset-bottom,0px));z-index:10;gap:2px;padding:5px;border-radius:999px;border:1px solid var(--line);background:color-mix(in srgb,var(--surface) 88%,transparent);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);box-shadow:0 6px 24px rgba(0,0,0,.18)}
    nav button{flex:1;flex-direction:column;gap:3px;min-height:52px;padding:6px 0;border:0;border-radius:999px;font-size:11px}
    nav button.on{background:var(--sunken)}
    main{padding:8px 16px 110px}
  }
</style>
