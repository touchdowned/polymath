<script lang="ts">
  import type { Snippet } from 'svelte'
  let { children, pad = 24 }: { children: Snippet; pad?: number } = $props()
</script>
<section style="padding:{pad}px">{@render children()}</section>
<style>section{background:var(--surface);border:2px solid var(--line);border-radius:var(--r-card)}</style>
