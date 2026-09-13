<script lang="ts">
	type Props = {
		width?: string;
		height?: string;
		radius?: 'sm' | 'md' | 'lg' | 'pill';
	};

	let { width = '100%', height = '1rem', radius = 'md' }: Props = $props();
</script>

<span class={`skeleton skeleton--${radius}`} style:width style:height aria-hidden="true"></span>

<style>
	.skeleton {
		display: block;
		max-width: 100%;
		background: linear-gradient(
			90deg,
			var(--nb-neutral-90) 20%,
			var(--nb-neutral-95) 40%,
			var(--nb-neutral-90) 60%
		);
		background-size: 220% 100%;
		animation: shimmer 1.4s ease-in-out infinite;
	}
	.skeleton--sm {
		border-radius: var(--nb-radius-sm);
	}
	.skeleton--md {
		border-radius: var(--nb-radius-md);
	}
	.skeleton--lg {
		border-radius: var(--nb-radius-lg);
	}
	.skeleton--pill {
		border-radius: var(--nb-radius-pill);
	}
	@keyframes shimmer {
		0% {
			background-position: 100% 0;
		}
		100% {
			background-position: -100% 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.skeleton {
			background: var(--nb-neutral-90);
			animation: none;
		}
	}
</style>
