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
		viewBox="0 0 100 100"
		role={decorative ? undefined : 'img'}
		aria-hidden={decorative ? 'true' : undefined}
		aria-label={decorative ? undefined : title}
	>
		{#if !decorative}
			<title>{title}</title>
		{/if}
		<g fill="currentColor">
			<path d="M10 10H35V90H10Z" />
			<path d="M68 10H90V90H70L68 88Z" />
			<path d="M10 10H35L90 65V90H70L10 30Z" />
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
