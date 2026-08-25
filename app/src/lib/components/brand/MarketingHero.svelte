<script lang="ts">
	type Props = {
		eyebrow?: string;
		title?: string;
		highlight?: string;
		description?: string;
		primaryLabel?: string;
		primaryHref?: string;
		secondaryLabel?: string;
		secondaryHref?: string;
	};

	let {
		eyebrow = 'Built environment operating platform',
		title = 'The operating system for the',
		highlight = 'built environment.',
		description =
			'Connect your people, projects, processes and business through one governed operating platform.',
		primaryLabel = 'Get started',
		primaryHref = '/start',
		secondaryLabel = 'Sign in',
		secondaryHref = '/signin'
	}: Props = $props();
</script>

<section class="hero" aria-labelledby="nublox-hero-title">
	<div class="hero-grid" aria-hidden="true">
		<div class="structure structure-a"></div>
		<div class="structure structure-b"></div>
		<div class="structure structure-c"></div>
	</div>
	<div class="hero-glow" aria-hidden="true"></div>

	<div class="hero-inner">
		<div class="hero-copy">
			<p class="eyebrow">{eyebrow}</p>
			<h1 id="nublox-hero-title">
				{title}
				<span>{highlight}</span>
			</h1>
			<p class="description">{description}</p>
			<div class="hero-actions">
				<a class="primary" href={primaryHref}>
					{primaryLabel}<span aria-hidden="true">→</span>
				</a>
				<a class="secondary" href={secondaryHref}>{secondaryLabel}</a>
			</div>
		</div>

		<aside class="platform-card" aria-label="NuBlox platform proposition">
			<span class="card-kicker">One connected foundation</span>
			<strong>Business + project operations</strong>
			<p>
				Shared records, governed workflows and role-aware workspaces across the building lifecycle.
			</p>
			<div class="capabilities" aria-label="Platform capabilities">
				<span>Projects</span>
				<span>Commercial</span>
				<span>Finance</span>
				<span>Procurement</span>
				<span>Workforce</span>
				<span>Information</span>
			</div>
		</aside>
	</div>
</section>

<style>
	.hero {
		position: relative;
		isolation: isolate;
		min-height: min(48rem, calc(100vh - 5rem));
		display: grid;
		align-items: center;
		overflow: hidden;
		background:
			radial-gradient(circle at 76% 24%, rgb(20 110 245 / 0.24), transparent 32%),
			linear-gradient(135deg, #07182e 0%, #0a2343 58%, #07182e 100%);
		color: white;
	}

	.hero-inner {
		position: relative;
		z-index: 2;
		width: min(88rem, calc(100% - 2rem));
		margin: 0 auto;
		display: grid;
		grid-template-columns: minmax(0, 1.18fr) minmax(18rem, 0.62fr);
		align-items: center;
		gap: clamp(2rem, 7vw, 7rem);
		padding: clamp(5rem, 9vw, 8rem) 0;
	}

	.hero-copy {
		max-width: 52rem;
	}

	.eyebrow {
		margin: 0 0 1.25rem;
		color: var(--nb-cyan);
		font-size: 0.78rem;
		font-weight: 820;
		letter-spacing: 0.13em;
		text-transform: uppercase;
	}

	h1 {
		margin: 0;
		max-width: 13ch;
		font-size: clamp(3rem, 7vw, 6.4rem);
		font-weight: 790;
		letter-spacing: -0.065em;
		line-height: 0.95;
		text-wrap: balance;
	}

	h1 span {
		display: block;
		background: var(--nb-brand-gradient);
		background-clip: text;
		-webkit-background-clip: text;
		color: transparent;
	}

	.description {
		max-width: 42rem;
		margin: 1.75rem 0 0;
		padding-left: 1.1rem;
		border-left: 3px solid var(--nb-blue);
		color: rgb(255 255 255 / 0.72);
		font-size: clamp(1rem, 1.8vw, 1.25rem);
		line-height: 1.65;
	}

	.hero-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.85rem;
		margin-top: 2.1rem;
	}

	.hero-actions a {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.65rem;
		min-height: 3rem;
		padding: 0 1.15rem;
		border-radius: var(--nb-radius-sm);
		font-size: 0.9rem;
		font-weight: 760;
		text-decoration: none;
	}

	.primary {
		background: var(--nb-blue);
		color: white;
		box-shadow: 0 14px 34px rgb(20 110 245 / 0.27);
	}

	.primary:hover,
	.primary:focus-visible {
		background: var(--nb-blue-strong);
	}

	.secondary {
		border: 1px solid rgb(255 255 255 / 0.28);
		background: rgb(255 255 255 / 0.04);
		color: white;
	}

	.secondary:hover,
	.secondary:focus-visible {
		background: rgb(255 255 255 / 0.09);
	}

	.platform-card {
		position: relative;
		padding: clamp(1.35rem, 3vw, 2rem);
		border: 1px solid rgb(255 255 255 / 0.15);
		border-radius: var(--nb-radius-xl);
		background: linear-gradient(145deg, rgb(255 255 255 / 0.12), rgb(255 255 255 / 0.045));
		box-shadow: 0 28px 80px rgb(0 0 0 / 0.22);
		backdrop-filter: blur(18px);
	}

	.platform-card::before {
		content: '';
		position: absolute;
		inset: 0.7rem auto 0.7rem 0;
		width: 3px;
		border-radius: 999px;
		background: var(--nb-brand-gradient);
	}

	.card-kicker {
		display: block;
		margin-bottom: 0.55rem;
		color: var(--nb-cyan);
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.platform-card strong {
		display: block;
		font-size: clamp(1.5rem, 2.5vw, 2rem);
		letter-spacing: -0.035em;
		line-height: 1.1;
	}

	.platform-card p {
		margin: 0.9rem 0 1.2rem;
		color: rgb(255 255 255 / 0.68);
		font-size: 0.9rem;
		line-height: 1.6;
	}

	.capabilities {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.capabilities span {
		padding: 0.38rem 0.55rem;
		border: 1px solid rgb(255 255 255 / 0.12);
		border-radius: 999px;
		background: rgb(255 255 255 / 0.06);
		color: rgb(255 255 255 / 0.8);
		font-size: 0.68rem;
		font-weight: 680;
	}

	.hero-grid {
		position: absolute;
		z-index: 0;
		right: -7rem;
		bottom: -10rem;
		width: min(63vw, 60rem);
		height: 43rem;
		transform: perspective(56rem) rotateY(-12deg) rotateX(2deg);
		opacity: 0.58;
	}

	.structure {
		position: absolute;
		bottom: 0;
		border: 1px solid rgb(32 184 216 / 0.28);
		background:
			repeating-linear-gradient(90deg, transparent 0 3.6rem, rgb(20 110 245 / 0.18) 3.6rem 3.67rem),
			repeating-linear-gradient(0deg, transparent 0 3rem, rgb(32 184 216 / 0.15) 3rem 3.06rem),
			linear-gradient(160deg, rgb(20 110 245 / 0.1), rgb(7 24 46 / 0.02));
		box-shadow: inset 0 0 60px rgb(20 110 245 / 0.08);
	}

	.structure-a {
		right: 0;
		width: 58%;
		height: 92%;
	}

	.structure-b {
		right: 48%;
		width: 34%;
		height: 64%;
	}

	.structure-c {
		right: 74%;
		width: 24%;
		height: 42%;
	}

	.hero-glow {
		position: absolute;
		z-index: 1;
		right: 12%;
		bottom: 4%;
		width: 24rem;
		height: 24rem;
		border-radius: 50%;
		background: rgb(20 110 245 / 0.14);
		filter: blur(70px);
	}

	@media (max-width: 900px) {
		.hero-inner {
			grid-template-columns: 1fr;
			gap: 2.5rem;
		}

		.platform-card {
			max-width: 38rem;
		}

		.hero-grid {
			width: 82vw;
			opacity: 0.34;
		}
	}

	@media (max-width: 560px) {
		.hero {
			min-height: auto;
		}

		.hero-inner {
			padding-block: 4rem;
		}

		h1 {
			font-size: clamp(2.6rem, 14vw, 4.2rem);
		}

		.platform-card {
			display: none;
		}
	}
</style>
