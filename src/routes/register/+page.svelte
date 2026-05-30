<script>
	import { base } from '$app/paths';
	import { api } from '$lib/api.js';
	import { showFlash } from '$lib/store.js';

	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let error = $state('');
	let success = $state(false);

	async function handleRegister() {
		error = '';
		if (password !== confirmPassword) {
			error = 'Passwords do not match';
			return;
		}
		try {
			await api.register(email, password);
			success = true;
			showFlash('Registration successful! Check your email to verify your account.');
		} catch (e) {
			error = e.message;
		}
	}
</script>

<svelte:head>
	<title>Register - Radegast</title>
</svelte:head>

<div class="row justify-content-center">
	<div class="col-md-6 col-lg-4">
		<h2 class="mb-4">Register</h2>
		{#if success}
			<div class="alert alert-success">
				Registration successful! Please check your email and click the verification link.
			</div>
			<p class="text-center"><a href="{base}/login">Go to Login</a></p>
		{:else}
			{#if error}
				<div class="alert alert-danger">{error}</div>
			{/if}
			<form onsubmit={(e) => { e.preventDefault(); handleRegister(); }}>
				<div class="mb-3">
					<label for="email" class="form-label">Email</label>
					<input type="email" class="form-control" id="email" bind:value={email} required />
				</div>
				<div class="mb-3">
					<label for="password" class="form-label">Password</label>
					<input
						type="password"
						class="form-control"
						id="password"
						bind:value={password}
						required
						minlength="8"
					/>
				</div>
				<div class="mb-3">
					<label for="confirm" class="form-label">Confirm Password</label>
					<input
						type="password"
						class="form-control"
						id="confirm"
						bind:value={confirmPassword}
						required
					/>
				</div>
				<button type="submit" class="btn btn-primary w-100">Register</button>
			</form>
			<p class="mt-3 text-center">
				Already have an account? <a href="{base}/login">Login</a>
			</p>
		{/if}
	</div>
</div>
