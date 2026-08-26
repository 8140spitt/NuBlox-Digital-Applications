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
		viewBox="0 0 540 470"
		role={decorative ? undefined : 'img'}
		aria-hidden={decorative ? 'true' : undefined}
		aria-label={decorative ? undefined : title}
	>
		{#if !decorative}
			<title>{title}</title>
		{/if}
		<g fill="currentColor">
			<path d="M38 18H180V434Q180 452 162 452H38Q18 452 18 432V38Q18 18 38 18Z" />
			<path
				d="M392 18H502Q522 18 522 38V432Q522 452 502 452H392Q374 452 374 434V38Q374 18 392 18Z"
			/>
			<path d="M38 18H184L522 356V432Q522 452 502 452H390L18 62V38Q18 18 38 18Z" />
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
		aspect-ratio: 540 / 470;
		flex: 0 0 auto;
		object-fit: contain;
		overflow: visible;
	}
</style>
