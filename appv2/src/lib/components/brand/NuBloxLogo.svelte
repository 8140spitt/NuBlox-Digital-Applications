<script lang="ts">
	import logo from '$lib/assets/brand/nublox-logo.svg';

	type Variant = 'full' | 'mark';

	let {
		variant = 'full',
		alt = 'NuBlox — Construction & Built Environment',
		class: className = ''
	}: {
		variant?: Variant;
		alt?: string;
		class?: string;
	} = $props();
</script>

<span class={`nublox-logo nublox-logo--${variant} ${className}`}>
	<img src={logo} {alt} />
</span>

<style>
	.nublox-logo {
		display: inline-block;
		flex: 0 0 auto;
		line-height: 0;
	}

	.nublox-logo img {
		display: block;
		height: 100%;
		max-width: none;
	}

	.nublox-logo--full {
		width: 100%;
		aspect-ratio: 1193 / 384;
	}

	.nublox-logo--full img {
		width: 100%;
		height: auto;
	}

	.nublox-logo--mark {
		width: 100%;
		aspect-ratio: 1;
		overflow: hidden;
		border-radius: 12%;
	}

	.nublox-logo--mark img {
		width: auto;
		height: 100%;
	}
</style>
