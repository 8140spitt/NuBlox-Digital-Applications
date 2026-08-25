<script lang="ts">
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
	<rect class:mono={monochrome} class="left" x="12" y="14" width="20" height="68" rx="4" />
	<rect class:mono={monochrome} class="right" x="64" y="14" width="20" height="68" rx="4" />
	<path class:mono={monochrome} class="diagonal" d="M22 14h17l45 52v16H67L22 30V14Z" />
	{#if !monochrome}
		<path class="fold" d="M22 48h17l12 14H34c-6.627 0-12-5.373-12-12v-2Z" />
	{/if}
</svg>

<style>
	.nublox-mark {
		display: block;
		width: var(--nublox-mark-size);
		height: var(--nublox-mark-size);
		flex: 0 0 auto;
		overflow: visible;
	}

	.left {
		fill: var(--nb-blue, #146ef5);
	}

	.right {
		fill: var(--nb-cyan, #20b8d8);
	}

	.diagonal {
		fill: #0b7bff;
	}

	.mono {
		fill: currentColor;
	}

	.fold {
		fill: var(--nb-ink, #07182e);
		opacity: 0.2;
	}
</style>
