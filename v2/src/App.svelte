<script lang="ts">
  import { session } from './lib/session.svelte'
  import { route } from './lib/router.svelte'
  import Shell from './lib/ui/Shell.svelte'
  import SignIn from './pages/SignIn.svelte'
  import Home from './pages/Home.svelte'
  import Study from './pages/Study.svelte'
  import Drill from './pages/Drill.svelte'
  import Compete from './pages/Compete.svelte'
  import You from './pages/You.svelte'
</script>

{#if !session.ready}
  <p class="boot muted">Loading</p>
{:else if !session.user}
  <SignIn />
{:else}
  <Shell>
    {#if route.page === 'home'}<Home />
    {:else if route.page === 'study'}<Study />
    {:else if route.page === 'drill'}<Drill />
    {:else if route.page === 'compete'}<Compete />
    {:else}<You />{/if}
  </Shell>
{/if}

<style>.boot{display:grid;place-items:center;height:100vh}</style>
