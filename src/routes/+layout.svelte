<script>
	import 'bootstrap/dist/css/bootstrap.min.css';
	import Navbar from '$lib/components/Navbar.svelte';

	let { children } = $props();
</script>

<Navbar />
<main class="container mt-4">
	{@render children()}
</main>
