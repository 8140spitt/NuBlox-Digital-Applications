<script lang="ts">
	import SignInSurface from '$lib/components/auth/SignInSurface.svelte';

	let { data } = $props();
</script>

<SignInSurface
	contextLabel="Tenant application"
	contextName={data.tenant}
	destination={data.destination}
	forgotPasswordHref={data.forgotPasswordHref}
	startHref={data.startHref}
/>
