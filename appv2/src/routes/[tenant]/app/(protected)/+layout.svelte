<script lang="ts">
	import ApplicationShell from '$lib/components/shell/ApplicationShell.svelte';

	let { data, children } = $props();
</script>

<ApplicationShell tenant={data.tenant} user={data.user}>
	{@render children()}
</ApplicationShell>
