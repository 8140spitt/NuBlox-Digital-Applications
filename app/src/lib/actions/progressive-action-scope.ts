import { enhance } from '$app/forms';
import { goto } from '$app/navigation';

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

export function progressiveActionScope(scope: HTMLElement) {
	const enhanced = new Map<HTMLFormElement, () => void>();
	let feedback: HTMLDivElement | null = null;

	function showFeedback(kind: 'pending' | 'success' | 'error', message: string) {
		if (!feedback) {
			feedback = document.createElement('div');
			scope.prepend(feedback);
		}
		feedback.className = `progressive-action-feedback ${kind}`;
		feedback.setAttribute('role', kind === 'error' ? 'alert' : 'status');
		feedback.setAttribute('aria-live', kind === 'error' ? 'assertive' : 'polite');
		feedback.textContent = message;
	}

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
			showFeedback('pending', `${label}…`);

			return async ({ result, update }) => {
				try {
					if (result.type === 'redirect') {
						await goto(result.location, {
							invalidateAll: true,
							noScroll: true,
							keepFocus: true
						});
						showFeedback('success', `${label} completed.`);
						return;
					}

					await update({ reset: false, invalidateAll: result.type === 'success' });
					if (result.type === 'failure') {
						showFeedback(
							'error',
							failureMessage(result.data) ?? `${label} could not be completed.`
						);
					} else if (result.type === 'success') {
						showFeedback('success', `${label} completed.`);
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

	return {
		destroy() {
			observer.disconnect();
			for (const destroy of enhanced.values()) destroy();
			enhanced.clear();
			feedback?.remove();
		}
	};
}
