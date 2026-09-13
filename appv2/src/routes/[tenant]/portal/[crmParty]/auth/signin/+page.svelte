<script lang="ts">
	import SignInSurface from '$lib/components/auth/SignInSurface.svelte';

	let { data } = $props();
</script>

<SignInSurface
	contextLabel="Connected portal"
	contextName={data.contextName}
	destination={data.destination}
	forgotPasswordHref={data.forgotPasswordHref}
	startHref={data.startHref}
/>
