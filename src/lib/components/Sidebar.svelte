<script lang="ts">
	import { base } from '$app/paths';
	import { user, flash } from '$lib/store';
	import { api } from '$lib/api';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { theme, type ThemeType } from '$lib/theme';
	import { fly } from 'svelte/transition';
	import Icon from '@iconify/svelte';

	async function logout(): Promise<void> {
		await api.logout();
		$user = null;
		goto(`${base}/login`);
	}

	function cycleTheme() {
		const current = $theme;
		if (current === 'auto') $theme = 'light';
		else if (current === 'light') $theme = 'dark';
		else $theme = 'auto';
	}

	$effect(() => {
		// Just to react to pathname changes for active state
		$page.url.pathname;
	});

	function isActive(path: string) {
		const current = $page.url.pathname;
		if (path === '/' && current === base + '/') return true;
		if (path !== '/' && current.startsWith(base + path)) return true;
		return false;
	}
	let collapsed = $state(false);

	// Load collapse state
	$effect(() => {
		if (typeof window !== 'undefined') {
			const saved = localStorage.getItem('radegast-sidebar-collapsed');
			if (saved === 'true') collapsed = true;
		}
	});

	function toggleCollapse() {
		collapsed = !collapsed;
		if (typeof window !== 'undefined') {
			localStorage.setItem('radegast-sidebar-collapsed', String(collapsed));
		}
	}
	
	let mobileOpen = $state(false);

	$effect(() => {
		// Close mobile menu on navigation
		$page.url.pathname;
		mobileOpen = false;
	});

	let dropdownOpen = $state(false);

	function toggleDropdown(e: Event) {
		e.stopPropagation();
		dropdownOpen = !dropdownOpen;
	}

	function closeDropdown() {
		dropdownOpen = false;
	}
</script>

<svelte:window onclick={closeDropdown} />


{#if $user}
	<!-- Mobile top bar -->
	<div class="d-md-none d-flex align-items-center justify-content-between bg-body-tertiary border-bottom p-2 w-100 sticky-top z-3">
		<a href="{base}/" class="text-decoration-none ms-2"><span class="fs-5 fw-bold text-primary">Radegast</span></a>
		<button class="btn btn-outline-secondary border-0" onclick={() => mobileOpen = !mobileOpen}>
			<span class="fs-4">☰</span>
		</button>
	</div>

	<!-- Mobile Overlay -->
	{#if mobileOpen}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="d-md-none" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1040;" onclick={() => mobileOpen = false}></div>
	{/if}	<div class="sidebar d-flex flex-column flex-shrink-0 p-2 bg-body-tertiary border-end {mobileOpen ? 'mobile-open' : ''}" style="--sidebar-width: {collapsed ? '60px' : '180px'};">
		<div class="d-none d-md-flex align-items-center justify-content-center mb-3 px-1 mt-2">
			<a href="{base}/" class="link-body-emphasis text-decoration-none text-truncate logo">
				<span class="logo-parenthesis">[</span>
				<span class="fs-5 fw-bold">{collapsed ? 'r' : 'radegast'}</span>
				<span class="logo-parenthesis">]</span>
			</a>
		</div>
		<hr class="mt-0 d-none d-md-block">
		
		<ul class="nav nav-pills flex-column mb-auto">
			<li class="nav-item">
				<a href="{base}/" class="nav-link {isActive('/') ? 'active' : 'link-body-emphasis'} d-flex align-items-center {collapsed ? 'justify-content-center' : 'gap-2'}" title="Dashboard">
					<Icon icon="lucide:layout-dashboard" width="20" height="20" />
					{#if !collapsed}<span class="text-truncate">Dashboard</span>{/if}
				</a>
			</li>
			<li>
				<a href="{base}/teams" class="nav-link {isActive('/teams') ? 'active' : 'link-body-emphasis'} d-flex align-items-center {collapsed ? 'justify-content-center' : 'gap-2'}" title="Teams">
					<Icon icon="lucide:users" width="20" height="20" />
					{#if !collapsed}<span class="text-truncate">Teams</span>{/if}
				</a>
			</li>
			<li>
				<a href="{base}/groups" class="nav-link {isActive('/groups') ? 'active' : 'link-body-emphasis'} d-flex align-items-center {collapsed ? 'justify-content-center' : 'gap-2'}" title="Groups">
					<Icon icon="lucide:server" width="20" height="20" />
					{#if !collapsed}<span class="text-truncate">Groups</span>{/if}
				</a>
			</li>
			<li>
				<a href="{base}/devices" class="nav-link {isActive('/devices') ? 'active' : 'link-body-emphasis'} d-flex align-items-center {collapsed ? 'justify-content-center' : 'gap-2'}" title="Devices">
					<Icon icon="lucide:laptop" width="20" height="20" />
					{#if !collapsed}<span class="text-truncate">Devices</span>{/if}
				</a>
			</li>
			<li>
				<a href="{base}/packs" class="nav-link {isActive('/packs') ? 'active' : 'link-body-emphasis'} d-flex align-items-center {collapsed ? 'justify-content-center' : 'gap-2'}" title="Packs">
					<Icon icon="lucide:package" width="20" height="20" />
					{#if !collapsed}<span class="text-truncate">Packs</span>{/if}
				</a>
			</li>
			<li>
				<a href="{base}/alerts" class="nav-link {isActive('/alerts') ? 'active' : 'link-body-emphasis'} d-flex align-items-center {collapsed ? 'justify-content-center' : 'gap-2'}" title="Alerts">
					<Icon icon="lucide:bell" width="20" height="20" />
					{#if !collapsed}<span class="text-truncate">Alerts</span>{/if}
				</a>
			</li>
			{#if $user.extended_edr_enabled}
				<li>
					<a href="{base}/hunt" class="nav-link {isActive('/hunt') ? 'active text-bg-warning' : 'link-body-emphasis fw-bold text-warning'} d-flex align-items-center {collapsed ? 'justify-content-center' : 'gap-2'}" title="Hunt Mode">
						<Icon icon="lucide:crosshair" width="20" height="20" />
						{#if !collapsed}<span class="text-truncate">Hunt Mode</span>{/if}
					</a>
				</li>
			{/if}
 
 			{#if $user.role === 'admin'}
				<hr>
				{#if !collapsed}
					<h6 class="sidebar-heading d-flex justify-content-between align-items-center px-2 mt-1 mb-1 text-muted text-uppercase text-truncate" style="font-size: 0.7rem; letter-spacing: 0.05em;">
						<span>Admin</span>
					</h6>
				{/if}
				<li>
					<a href="{base}/admin" class="nav-link {isActive('/admin') ? 'active' : 'link-body-emphasis'} d-flex align-items-center {collapsed ? 'justify-content-center' : 'gap-2'}" title="Admin">
						<Icon icon="lucide:shield" width="20" height="20" />
						{#if !collapsed}<span class="text-truncate">Admin</span>{/if}
					</a>
				</li>
				<li>
					<a href="{base}/releases" class="nav-link {isActive('/releases') ? 'active' : 'link-body-emphasis'} d-flex align-items-center {collapsed ? 'justify-content-center' : 'gap-2'}" title="Releases">
						<Icon icon="lucide:archive" width="20" height="20" />
						{#if !collapsed}<span class="text-truncate">Releases</span>{/if}
					</a>
				</li>
			{/if}
		</ul>
		<div class="d-none d-md-flex align-items-center {collapsed ? 'justify-content-center' : 'justify-content-end'} px-2 mb-2">
			<button class="btn btn-sm btn-outline-secondary border-0 text-center w-100 d-flex justify-content-between align-items-center" onclick={toggleCollapse} title="Toggle Sidebar" style="min-width: 32px; padding: 0.25rem;">
				{#if !collapsed}
					<Icon icon="pajamas:collapse-left"></Icon>
					<span>Hide Sidebar</span>
				{:else}
					<Icon icon="pajamas:collapse-right"></Icon>
				{/if}
			</button>
		</div>
		<hr class="mt-0">
		<div class="dropdown">
			<button
				type="button"
				class="btn btn-link p-0 border-0 d-flex align-items-center link-body-emphasis text-decoration-none {collapsed ? 'justify-content-center' : 'dropdown-toggle'} {dropdownOpen ? 'show' : ''}"
				aria-expanded={dropdownOpen}
				onclick={toggleDropdown}
				title="{$user.email}"
			>
				<div style="width: 32px; height: 32px; border-radius: 50%; background-color: var(--bs-primary); color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; {collapsed ? '' : 'margin-right: 10px;'} flex-shrink-0">
					{$user.email.charAt(0).toUpperCase()}
				</div>
				{#if !collapsed}
					<strong class="text-truncate" style="max-width: 120px;">{$user.email}</strong>
				{/if}
			</button>
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<ul 
				class="dropdown-menu text-small shadow custom-dropdown-menu {collapsed ? 'collapsed' : 'expanded'} {dropdownOpen ? 'show' : ''}"
				onclick={(e) => e.stopPropagation()}
			>
				<li><a class="dropdown-item" href="{base}/settings" onclick={closeDropdown}>Settings</a></li>
				<li>
					<button class="dropdown-item d-flex align-items-center justify-content-between" onclick={cycleTheme}>
						Theme: <span class="badge text-bg-secondary text-capitalize">{$theme}</span>
					</button>
				</li>
				<li><hr class="dropdown-divider"></li>
				<li><button class="dropdown-item text-danger" onclick={(e) => { closeDropdown(); logout(); }}>Sign out</button></li>
			</ul>
		</div>
	</div>
{:else}
	<!-- Top navbar for public routes (login/register) -->
	<nav class="navbar navbar-expand-lg bg-body-tertiary border-bottom w-100">
		<div class="container-fluid px-4">
			<a class="navbar-brand fw-bold text-primary" href="{base}/">Radegast EDR</a>
			<div class="ms-auto d-flex gap-2">
				<button class="btn btn-sm btn-outline-secondary" onclick={cycleTheme}>Theme: {$theme}</button>
				<a class="btn btn-sm btn-outline-primary" href="{base}/login">Login</a>
				<a class="btn btn-sm btn-primary" href="{base}/register">Register</a>
			</div>
		</div>
	</nav>
{/if}

{#if $flash}
	<div class="toast-container position-fixed bottom-0 end-0 p-3" style="z-index: 2050;">
		<div
			transition:fly={{ y: 50, duration: 300 }}
			class="toast align-items-center text-bg-{$flash.type === 'danger' ? 'danger' : ($flash.type === 'success' ? 'success' : $flash.type)} border-0 show shadow-lg"
			role="alert"
			aria-live="assertive"
			aria-atomic="true"
			style="border-radius: 3px;"
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

<style>
	.logo {
		.logo-parenthesis {
			color: #0f8;
		}
	}

	.sidebar {
		transition: width 0.2s, transform 0.3s;
		height: 100vh;
		position: sticky;
		top: 0;
		overflow-y: auto;
		overflow-x: hidden;
		width: var(--sidebar-width);
	}
	
	@media (max-width: 767.98px) {
		.sidebar {
			position: fixed;
			z-index: 1050;
			left: 0;
			transform: translateX(-100%);
			width: 250px !important;
		}
		.sidebar.mobile-open {
			transform: translateX(0);
		}
	}

	.nav-link {
		transition: background-color 0.15s ease-in-out, color 0.15s ease-in-out;
		border-radius: 3px;
		margin-bottom: 2px;
	}
	.nav-link:hover:not(.active) {
		background-color: var(--bs-secondary-bg);
	}

	.custom-dropdown-menu {
		position: fixed;
		bottom: 10px;
		margin-bottom: 8px;
		z-index: 1060;
	}
	.custom-dropdown-menu.collapsed {
		left: 50px;
	}
	.custom-dropdown-menu.expanded {
		left: 10px;
	}
	@media (max-width: 767.98px) {
		.custom-dropdown-menu {
			position: absolute;
			bottom: 100%;
			left: 0;
		}
	}
</style>
