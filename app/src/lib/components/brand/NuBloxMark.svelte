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
		viewBox="0 0 96 96"
		role={decorative ? undefined : 'img'}
		aria-hidden={decorative ? 'true' : undefined}
		aria-label={decorative ? undefined : title}
	>
		{#if !decorative}
			<title>{title}</title>
		{/if}
		<g fill="currentColor">
			<path d="M14 14H36V82H14Z" />
			<path d="M60 14H82V82H60Z" />
			<path d="M14 14H36L82 60V82H60L14 36Z" />
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
