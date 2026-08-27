<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { onMount, type Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
	let scope: HTMLDivElement;
	let feedback = $state<{
		kind: 'pending' | 'success' | 'error';
		message: string;
	} | null>(null);

	function actionLabel(submitter: HTMLElement | null): string {
		return (
			submitter?.textContent?.trim() ||
			submitter?.getAttribute('aria-label')?.trim() ||
			'Action'
		);
	}

	function failureMessage(data: unknown): string | null {
		if (!data || typeof data !== 'object') return null;
		const record = data as Record<string, unknown>;
		if (typeof record.error === 'string') return record.error;
		if (typeof record.financialError === 'string') return record.financialError;
		return null;
	}

	onMount(() => {
		const enhanced = new Map<HTMLFormElement, () => void>();

		function bind(form: HTMLFormElement) {
			if (enhanced.has(form) || form.method.toLowerCase() !== 'post') return;
			const action = enhance(form, ({ submitter }) => {
				const label = actionLabel(submitter);
				const control =
					submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement
						? submitter
						: null;
				const wasDisabled = control?.disabled ?? false;
				form.setAttribute('aria-busy', 'true');
				if (control) control.disabled = true;
				feedback = { kind: 'pending', message: `${label}…` };

				return async ({ result, update }) => {
					try {
						if (result.type === 'redirect') {
							await goto(result.location, {
								invalidateAll: true,
								noScroll: true,
								keepFocus: true
							});
							feedback = { kind: 'success', message: `${label} completed.` };
							return;
						}

						await update({ reset: false, invalidateAll: result.type === 'success' });
						if (result.type === 'failure') {
							feedback = {
								kind: 'error',
								message: failureMessage(result.data) ?? `${label} could not be completed.`
							};
						} else if (result.type === 'success') {
							feedback = { kind: 'success', message: `${label} completed.` };
						}
					} finally {
						form.removeAttribute('aria-busy');
						if (control) control.disabled = wasDisabled;
					}
				};
			});
			enhanced.set(form, action.destroy);
		}

		function synchroniseForms() {
			for (const [form, destroy] of enhanced) {
				if (scope.contains(form)) continue;
				destroy();
				enhanced.delete(form);
			}
			for (const form of scope.querySelectorAll<HTMLFormElement>('form')) bind(form);
		}

		synchroniseForms();
		const observer = new MutationObserver(synchroniseForms);
		observer.observe(scope, { childList: true, subtree: true });

		return () => {
			observer.disconnect();
			for (const destroy of enhanced.values()) destroy();
			enhanced.clear();
		};
	});
</script>

<div class="progressive-action-scope" bind:this={scope}>
	{#if feedback}
		<div
			class="action-feedback"
			class:pending={feedback.kind === 'pending'}
			class:error={feedback.kind === 'error'}
			role={feedback.kind === 'error' ? 'alert' : 'status'}
			aria-live={feedback.kind === 'error' ? 'assertive' : 'polite'}
		>
			{feedback.message}
		</div>
	{/if}
	{@render children()}
</div>

<style>
	.progressive-action-scope {
		display: contents;
	}

	.action-feedback {
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

	.action-feedback.pending {
		opacity: 0.78;
	}

	.action-feedback.error {
		border-color: var(--nb-danger, #b42318);
	}

	@media (max-width: 40rem) {
		.action-feedback {
			right: 0.75rem;
			bottom: 0.75rem;
			max-width: calc(100vw - 1.5rem);
		}
	}
</style>
