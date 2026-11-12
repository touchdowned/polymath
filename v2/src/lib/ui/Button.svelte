<script lang="ts">
  import type { Snippet } from 'svelte'
  let { kind = 'primary', onclick, disabled = false, type = 'button', children }:
    { kind?: 'primary' | 'tone' | 'plain'; onclick?: () => void; disabled?: boolean; type?: 'button' | 'submit'; children: Snippet } = $props()
</script>
<button class={kind} {type} {onclick} {disabled}>{@render children()}</button>
<style>
  button{min-height:52px;padding:0 26px;border-radius:var(--r-ctl);font-weight:800;font-size:17px;border:2px solid var(--line);background:var(--surface);color:var(--ink);transition:transform .08s,box-shadow .08s,background .2s}
  .primary{background:var(--accent);color:var(--accent-ink);border-color:var(--accent);box-shadow:0 5px 0 color-mix(in srgb,var(--accent) 70%,#000)}
  .tone{background:var(--tone);color:var(--tone-ink);border-color:var(--tone);box-shadow:0 5px 0 color-mix(in srgb,var(--tone) 68%,#000)}
  .primary:active,.tone:active{transform:translateY(3px);box-shadow:0 2px 0 color-mix(in srgb,var(--tone) 60%,#000)}
  .plain:hover{background:var(--sunken)}
  button:disabled{opacity:.5;cursor:default}
</style>
