<script lang="ts">
	import darkMarkUrl from '$lib/assets/brand/nublox-mark-dark.svg';
	import lightMarkUrl from '$lib/assets/brand/nublox-mark-light.svg';

	type Props = {
		size?: number | string;
		decorative?: boolean;
		title?: string;
		monochrome?: boolean;
		theme?: 'light' | 'dark';
		class?: string;
	};

	let {
		size = 32,
		decorative = true,
		title = 'NuBlox',
		monochrome = false,
		theme = 'light',
		class: className = ''
	}: Props = $props();

	let dimension = $derived(typeof size === 'number' ? `${size}px` : size);
	let markUrl = $derived(theme === 'dark' ? darkMarkUrl : lightMarkUrl);
</script>

{#if monochrome}
	<svg
		class={`nublox-mark ${className}`.trim()}
		style={`--nublox-mark-size: ${dimension}`}
		viewBox="0 0 335 338"
		role={decorative ? undefined : 'img'}
		aria-hidden={decorative ? 'true' : undefined}
		aria-label={decorative ? undefined : title}
		shape-rendering="geometricPrecision"
	>
		{#if !decorative}
			<title>{title}</title>
		{/if}
		<g fill="currentColor">
			<path
				d="M277.44 37.8444H213.44C209.021 37.8444 205.44 41.4261 205.44 45.8444V290.844C205.44 295.263 209.021 298.844 213.44 298.844H277.44C281.858 298.844 285.44 295.263 285.44 290.844V45.8444C285.44 41.4261 281.858 37.8444 277.44 37.8444Z"
			/>
			<path
				d="M118.44 37.8444H54.4396C50.0213 37.8444 46.4396 41.4261 46.4396 45.8444V290.844C46.4396 295.263 50.0213 298.844 54.4396 298.844H118.44C122.858 298.844 126.44 295.263 126.44 290.844V45.8444C126.44 41.4261 122.858 37.8444 118.44 37.8444Z"
			/>
			<path
				d="M53.8817 37.8444H117.713C120.339 37.8446 122.802 39.1952 124.279 41.4597L283.563 285.595C287.13 291.062 283.349 298.385 277.044 298.424L209.958 298.844C207.285 298.861 204.778 297.479 203.297 295.158L47.2694 50.6032C43.7657 45.1116 47.5922 37.8445 53.8817 37.8444Z"
			/>
		</g>
	</svg>
{:else}
	<img
		class={`nublox-mark ${className}`.trim()}
		style={`--nublox-mark-size: ${dimension}`}
		src={markUrl}
		alt={decorative ? '' : title}
		aria-hidden={decorative ? 'true' : undefined}
	/>
{/if}

<style>
	.nublox-mark {
		display: block;
		width: var(--nublox-mark-size);
		height: auto;
		max-height: var(--nublox-mark-size);
		aspect-ratio: 335 / 338;
		flex: 0 0 auto;
		object-fit: contain;
		overflow: visible;
	}
</style>
