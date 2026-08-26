<script lang="ts">
	import markUrl from '$lib/assets/brand/nublox-mark.svg';

	type Props = {
		size?: number | string;
		decorative?: boolean;
		title?: string;
		monochrome?: boolean;
		class?: string;
	};

	let {
		size = 32,
		decorative = true,
		title = 'NuBlox',
		monochrome = false,
		class: className = ''
	}: Props = $props();

	let dimension = $derived(typeof size === 'number' ? `${size}px` : size);
</script>

{#if monochrome}
	<svg
		class={`nublox-mark ${className}`.trim()}
		style={`--nublox-mark-size: ${dimension}`}
		viewBox="0 0 335 338"
		role={decorative ? undefined : 'img'}
		aria-hidden={decorative ? 'true' : undefined}
		aria-label={decorative ? undefined : title}
	>
		{#if !decorative}
			<title>{title}</title>
		{/if}
		<g fill="currentColor">
			<path d="M277.439 37.3444H213.105C208.686 37.3444 205.105 40.9261 205.105 45.3444V288.265C205.105 292.684 208.686 296.265 213.105 296.265H277.439C281.858 296.265 285.439 292.684 285.439 288.265V45.3444C285.439 40.9261 281.858 37.3444 277.439 37.3444Z" />
			<path d="M117.774 37.3444H53.4393C49.0211 37.3444 45.4393 40.9261 45.4393 45.3444V288.265C45.4393 292.684 49.0211 296.265 53.4393 296.265H117.774C122.192 296.265 125.774 292.684 125.774 288.265V45.3444C125.774 40.9261 122.192 37.3444 117.774 37.3444Z" />
			<path d="M46.8481 50.7685C43.1485 45.0141 47.1672 37.3444 53.8819 37.3444L117.712 37.3446C120.513 37.3446 123.131 38.7731 124.698 41.1567L283.982 283.429C287.749 289.158 283.778 296.886 277.047 296.928L209.961 297.344C207.111 297.362 204.446 295.9 202.875 293.457L46.8481 50.7685Z" />
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
