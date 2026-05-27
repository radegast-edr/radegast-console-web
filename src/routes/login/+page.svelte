<script>
	import { api } from '$lib/api.js';
	import { user, showError } from '$lib/store.js';
	import { goto } from '$app/navigation';

	let email = $state('');
	let password = $state('');
	let error = $state('');

	async function handleLogin() {
		error = '';
		try {
			await api.login(email, password);
			const me = await api.me();
			$user = me;
			goto('/');
		} catch (e) {
			error = e.message;
		}
	}
</script>

<svelte:head>
	<title>Login - Radegast</title>
</svelte:head>

<div class="row justify-content-center">
	<div class="col-md-6 col-lg-4">
		<h2 class="mb-4">Login</h2>
		{#if error}
			<div class="alert alert-danger">{error}</div>
		{/if}
		<form onsubmit={(e) => { e.preventDefault(); handleLogin(); }}>
			<div class="mb-3">
				<label for="email" class="form-label">Email</label>
				<input type="email" class="form-control" id="email" bind:value={email} required />
			</div>
			<div class="mb-3">
				<label for="password" class="form-label">Password</label>
				<input type="password" class="form-control" id="password" bind:value={password} required />
			</div>
			<button type="submit" class="btn btn-primary w-100">Login</button>
		</form>
		<p class="mt-3 text-center">
			Don't have an account? <a href="/register">Register</a>
		</p>
		<p class="text-center">
			<a href="/keys/recovery">Recover keys</a>
		</p>
	</div>
</div>
