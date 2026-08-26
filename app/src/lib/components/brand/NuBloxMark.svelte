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
		viewBox="90 80 840 840"
		role={decorative ? undefined : 'img'}
		aria-hidden={decorative ? 'true' : undefined}
		aria-label={decorative ? undefined : title}
	>
		{#if !decorative}
			<title>{title}</title>
		{/if}
		<g fill="currentColor">
			<rect x="150" y="130" width="260" height="740" />
			<rect x="670" y="130" width="190" height="740" />
			<path d="M150 130H410L860 580V870H650L335 545L150 360Z" />
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
		height: var(--nublox-mark-size);
		flex: 0 0 auto;
		object-fit: contain;
		overflow: visible;
	}
</style>
