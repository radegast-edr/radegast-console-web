<script>
	import 'bootstrap/dist/css/bootstrap.min.css';
	import Navbar from '$lib/components/Navbar.svelte';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { api } from '$lib/api.js';
	import { user } from '$lib/store.js';

	let { children } = $props();

	// Routes that are fully public (no auth needed)
	const PUBLIC_PREFIXES = ['/login', '/register'];
	// Routes that need auth but bypass the key-setup gate
	const KEY_EXEMPT_PREFIXES = ['/keys/'];

	onMount(async () => {
		const path = window.location.pathname;

		if (PUBLIC_PREFIXES.some((p) => path.startsWith(p))) return;

		try {
			const me = await api.me();
			$user = me;

			if (!me.has_keys && !KEY_EXEMPT_PREFIXES.some((p) => path.startsWith(p))) {
				goto('/keys/setup');
			}
		} catch {
			goto('/login');
		}
	});
</script>

<Navbar />
<main class="container mt-4">
	{@render children()}
</main>
