<script lang="ts">let { value }: { value: number } = $props()</script>
<div class="bar" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin="0" aria-valuemax="100"><i style="width:{Math.max(3, Math.round(value * 100))}%"></i></div>
<style>.bar{height:10px;border-radius:5px;background:var(--track);overflow:hidden}i{display:block;height:100%;border-radius:5px;background:var(--tone);transition:width .3s}</style>
