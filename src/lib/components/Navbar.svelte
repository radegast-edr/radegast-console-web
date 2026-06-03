<script lang="ts">
	import { base } from '$app/paths';
	import { user, flash } from '$lib/store';
	import { api } from '$lib/api';
	import { goto } from '$app/navigation';
	import { fly } from 'svelte/transition';
	import 'bootstrap/dist/js/bootstrap.bundle.min.js';

	async function logout(): Promise<void> {
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
			aria-label="Toggle navigation"
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
						<li class="nav-item">
							<a class="nav-link" href="{base}/releases">Releases</a>
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
	<div class="toast-container position-fixed bottom-0 end-0 p-3" style="z-index: 2050;">
		<div
			transition:fly={{ y: 50, duration: 300 }}
			class="toast align-items-center text-bg-{$flash.type === 'danger' ? 'danger' : ($flash.type === 'success' ? 'success' : $flash.type)} border-0 show shadow-lg"
			role="alert"
			aria-live="assertive"
			aria-atomic="true"
			style="border-radius: 8px;"
		>
			<div class="d-flex">
				<div class="toast-body fw-semibold py-3 ps-3 pe-2">
					{#if $flash.type === 'danger'}
						<span class="me-2">⚠️</span>
					{:else if $flash.type === 'success'}
						<span class="me-2">✓</span>
					{/if}
					{$flash.message}
				</div>
				<button
					type="button"
					class="btn-close btn-close-white me-3 m-auto"
					aria-label="Close"
					onclick={() => ($flash = null)}
				></button>
			</div>
		</div>
	</div>
{/if}
