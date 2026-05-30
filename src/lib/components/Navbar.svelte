<script>
	import { base } from '$app/paths';
	import { user, flash } from '$lib/store.js';
	import { api } from '$lib/api.js';
	import { goto } from '$app/navigation';

	async function logout() {
		await api.logout();
		$user = null;
		goto(`${base}/login`);
	}
</script>

<nav class="navbar navbar-expand-lg navbar-dark bg-dark">
	<div class="container">
		<a class="navbar-brand" href="{base}/">Radegast EDR Console</a>
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
						<a class="nav-link" href="{base}/">Dashboard</a>
					</li>
					<li class="nav-item">
						<a class="nav-link" href="{base}/teams">Teams</a>
					</li>
					<li class="nav-item">
						<a class="nav-link" href="{base}/groups">Groups</a>
					</li>
					<li class="nav-item">
						<a class="nav-link" href="{base}/devices">Devices</a>
					</li>
					<li class="nav-item">
						<a class="nav-link" href="{base}/packs">Packs</a>
					</li>
					<li class="nav-item">
						<a class="nav-link" href="{base}/alerts">Alerts</a>
					</li>
					{#if $user.role === 'admin'}
						<li class="nav-item">
							<a class="nav-link" href="{base}/admin">Admin</a>
						</li>
					{/if}
				</ul>
				<ul class="navbar-nav">
					<li class="nav-item">
						<a class="nav-link text-light" href="{base}/settings">{$user.email}</a>
					</li>
					<li class="nav-item">
						<button class="btn btn-outline-light btn-sm" onclick={logout}>Logout</button>
					</li>
				</ul>
			{:else}
				<ul class="navbar-nav ms-auto">
					<li class="nav-item">
						<a class="nav-link" href="{base}/login">Login</a>
					</li>
					<li class="nav-item">
						<a class="nav-link" href="{base}/register">Register</a>
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
