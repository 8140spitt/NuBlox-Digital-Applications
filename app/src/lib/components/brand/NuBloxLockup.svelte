<script lang="ts">
	import NuBloxMark from './NuBloxMark.svelte';

	type Props = {
		href?: string;
		product?: string;
		theme?: 'light' | 'dark' | 'mono';
		size?: 'sm' | 'md' | 'lg';
		ariaLabel?: string;
		class?: string;
	};

	let {
		href,
		product,
		theme = 'light',
		size = 'md',
		ariaLabel = product ? `NuBlox ${product}` : 'NuBlox',
		class: className = ''
	}: Props = $props();

	let classes = $derived(`lockup theme-${theme} size-${size} ${className}`.trim());
</script>

{#snippet identity()}
	<NuBloxMark size="var(--nb-lockup-mark)" monochrome={theme === 'mono'} />
	<span class="wordmark">NuBlox</span>
	{#if product}
		<span class="divider" aria-hidden="true"></span>
		<span class="product">{product}</span>
	{/if}
{/snippet}

{#if href}
	<a class={classes} {href} aria-label={ariaLabel}>
		{@render identity()}
	</a>
{:else}
	<span class={classes} role="img" aria-label={ariaLabel}>
		{@render identity()}
	</span>
{/if}

<style>
	.lockup {
		--nb-lockup-mark: 2.25rem;
		--nb-lockup-color: var(--nb-ink, #07182e);
		display: inline-flex;
		align-items: center;
		gap: 0.65rem;
		min-width: 0;
		color: var(--nb-lockup-color);
		text-decoration: none;
		line-height: 1;
	}

	.size-sm {
		--nb-lockup-mark: 1.75rem;
		gap: 0.5rem;
	}

	.size-lg {
		--nb-lockup-mark: 3rem;
		gap: 0.85rem;
	}

	.theme-dark {
		--nb-lockup-color: var(--nb-white, #ffffff);
	}

	.theme-mono {
		--nb-lockup-color: currentColor;
	}

	.wordmark {
		min-width: 0;
		color: var(--nb-lockup-color);
		font-family: var(--nb-font-sans, Inter, ui-sans-serif, system-ui, sans-serif);
		font-size: calc(var(--nb-lockup-mark) * 0.72);
		font-weight: 780;
		letter-spacing: -0.045em;
		white-space: nowrap;
	}

	.divider {
		width: 1px;
		height: calc(var(--nb-lockup-mark) * 0.7);
		margin-inline: 0.1rem;
		background: currentColor;
		opacity: 0.22;
	}

	.product {
		color: var(--nb-lockup-color);
		font-size: calc(var(--nb-lockup-mark) * 0.55);
		font-weight: 620;
		letter-spacing: -0.025em;
		white-space: nowrap;
	}

	a.lockup:hover .wordmark,
	a.lockup:focus-visible .wordmark {
		text-decoration: none;
	}
</style>
