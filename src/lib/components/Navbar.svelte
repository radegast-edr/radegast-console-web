<script>
	import { user, flash } from '$lib/store.js';
	import { api } from '$lib/api.js';
	import { goto } from '$app/navigation';

	async function logout() {
		await api.logout();
		$user = null;
		goto('/login');
	}
</script>

<nav class="navbar navbar-expand-lg navbar-dark bg-dark">
	<div class="container">
		<a class="navbar-brand" href="/">Radegast EDR Console</a>
		<button
			class="navbar-toggler"
			type="button"
			data-bs-toggle="collapse"
			data-bs-target="#navbarNav"
		>
			<span class="navbar-toggler-icon"></span>
		</button>
		<div class="collapse navbar-collapse" id="navbarNav">
			{#if $user}
				<ul class="navbar-nav me-auto">
					<li class="nav-item">
						<a class="nav-link" href="/">Dashboard</a>
					</li>
					<li class="nav-item">
						<a class="nav-link" href="/teams">Teams</a>
					</li>
					<li class="nav-item">
						<a class="nav-link" href="/groups">Groups</a>
					</li>
					<li class="nav-item">
						<a class="nav-link" href="/devices">Devices</a>
					</li>
					<li class="nav-item">
						<a class="nav-link" href="/packs">Packs</a>
					</li>
					<li class="nav-item">
						<a class="nav-link" href="/logs">Logs</a>
					</li>
					{#if $user.role === 'admin'}
						<li class="nav-item">
							<a class="nav-link" href="/admin">Admin</a>
						</li>
					{/if}
				</ul>
				<ul class="navbar-nav">
					<li class="nav-item">
						<a class="nav-link text-light" href="/settings">{$user.email}</a>
					</li>
					<li class="nav-item">
						<button class="btn btn-outline-light btn-sm" onclick={logout}>Logout</button>
					</li>
				</ul>
			{:else}
				<ul class="navbar-nav ms-auto">
					<li class="nav-item">
						<a class="nav-link" href="/login">Login</a>
					</li>
					<li class="nav-item">
						<a class="nav-link" href="/register">Register</a>
					</li>
				</ul>
			{/if}
		</div>
	</div>
</nav>

{#if $flash}
	<div class="container mt-2">
		<div class="alert alert-{$flash.type} alert-dismissible fade show" role="alert">
			{$flash.message}
			<button type="button" class="btn-close" onclick={() => ($flash = null)}></button>
		</div>
	</div>
{/if}
