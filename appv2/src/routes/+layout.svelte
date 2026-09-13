<script lang="ts">
	import '@fontsource-variable/noto-sans';
	import favicon from '$lib/assets/brand/nublox-logo.svg';
	import '../app.css';
	import '$lib/styles/brand.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>NuBlox</title>
	<meta
		name="description"
		content="NuBlox — construction and built-environment operating system"
	/>
</svelte:head>

{@render children()}
