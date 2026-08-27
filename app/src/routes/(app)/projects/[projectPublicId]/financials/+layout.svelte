<script lang="ts">
	import type { Snippet } from 'svelte';
	import ProgressiveActionScope from '$lib/components/ProgressiveActionScope.svelte';

	let { children }: { children: Snippet } = $props();
</script>

<ProgressiveActionScope>
	{@render children()}
</ProgressiveActionScope>
