<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>NuBlox V2</title>
	<meta
		name="description"
		content="NuBlox V2 — construction and built-environment operating system"
	/>
</svelte:head>

{@render children()}
