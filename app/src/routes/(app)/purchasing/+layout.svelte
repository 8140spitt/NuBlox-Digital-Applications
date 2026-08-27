<script lang="ts">
	import ProgressiveActionScope from '$lib/components/ProgressiveActionScope.svelte';

	let { children } = $props();
</script>

<ProgressiveActionScope>
	{@render children()}
</ProgressiveActionScope>
