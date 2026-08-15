<script lang="ts">
	let { data } = $props();
</script>

<h1>Application Dashboard</h1>
<p>This route sits behind the server request boundary and reads typed request context.</p>

<h2>Request context</h2>
<pre>{JSON.stringify(data.context, null, 2)}</pre>
