<script lang="ts">
	import type { Snippet } from 'svelte';
	import { progressiveActionScope } from '$lib/actions/progressive-action-scope';

	let { children }: { children: Snippet } = $props();
</script>

<div class="progressive-action-scope" use:progressiveActionScope>
	{@render children()}
</div>

<style>
	.progressive-action-scope {
		display: contents;
	}

	:global(.progressive-action-feedback) {
		position: fixed;
		right: 1.25rem;
		bottom: 1.25rem;
		z-index: 50;
		max-width: min(24rem, calc(100vw - 2.5rem));
		padding: 0.7rem 0.9rem;
		border: 1px solid var(--nb-border);
		border-radius: var(--nb-radius-sm);
		background: var(--nb-white);
		box-shadow: 0 0.55rem 1.6rem rgb(15 23 42 / 0.14);
		font-size: 0.86rem;
		font-weight: 700;
	}

	:global(.progressive-action-feedback.pending) {
		opacity: 0.78;
	}

	:global(.progressive-action-feedback.error) {
		border-color: var(--nb-danger, #b42318);
	}

	@media (max-width: 40rem) {
		:global(.progressive-action-feedback) {
			right: 0.75rem;
			bottom: 0.75rem;
			max-width: calc(100vw - 1.5rem);
		}
	}
</style>
