import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Navbar from './Navbar.svelte';
import { user, flash } from '$lib/store';
import { api } from '$lib/api';
import { goto } from '$app/navigation';

vi.mock('$app/navigation', () => ({
	goto: vi.fn()
}));

vi.mock('$lib/api', () => ({
	api: {
		logout: vi.fn(() => Promise.resolve())
	}
}));

describe('Navbar Component', () => {
	beforeEach(() => {
		user.set(null);
		flash.set(null);
		vi.clearAllMocks();
	});

	it('renders login and register when user is not logged in', () => {
		render(Navbar);
		expect(screen.getByText('Login')).toBeInTheDocument();
		expect(screen.getByText('Register')).toBeInTheDocument();
		expect(screen.queryByText('Dashboard')).toBeNull();
		expect(screen.queryByText('Admin')).toBeNull();
	});

	it('renders navigation links and user email for standard user', () => {
		user.set({
			id: 2,
			email: 'user@example.com',
			role: 'user',
			verified: true,
			has_keys: true,
			mfa_required_level: 'none',
			mfa_setup_missing: false,
			mfa_configured_level: 'none'
		});

		render(Navbar);
		expect(screen.getByText('Dashboard')).toBeInTheDocument();
		expect(screen.getByText('Teams')).toBeInTheDocument();
		expect(screen.getByText('Groups')).toBeInTheDocument();
		expect(screen.getByText('user@example.com')).toBeInTheDocument();
		expect(screen.queryByText('Admin')).toBeNull();
		expect(screen.queryByText('Releases')).toBeNull();
	});

	it('renders Admin and Releases links for admin user', () => {
		user.set({
			id: 1,
			email: 'admin@example.com',
			role: 'admin',
			verified: true,
			has_keys: true,
			mfa_required_level: 'none',
			mfa_setup_missing: false,
			mfa_configured_level: 'none'
		});

		render(Navbar);
		expect(screen.getByText('Admin')).toBeInTheDocument();
		expect(screen.getByText('Releases')).toBeInTheDocument();
	});

	it('handles logout flow correctly', async () => {
		user.set({
			id: 1,
			email: 'admin@example.com',
			role: 'admin',
			verified: true,
			has_keys: true,
			mfa_required_level: 'none',
			mfa_setup_missing: false,
			mfa_configured_level: 'none'
		});

		render(Navbar);
		const logoutBtn = screen.getByText('Logout');
		await fireEvent.click(logoutBtn);

		expect(api.logout).toHaveBeenCalledTimes(1);
		expect(get(user)).toBeNull();
		expect(goto).toHaveBeenCalledWith('/ui/login');
	});

	it('renders flash message toast when flash store is populated', async () => {
		flash.set({ message: 'Operation successful!', type: 'success' });
		const { container } = render(Navbar);

		expect(screen.getByText('Operation successful!')).toBeInTheDocument();
		expect(container.querySelector('.text-bg-success')).not.toBeNull();

		const closeBtn = screen.getByLabelText('Close');
		await fireEvent.click(closeBtn);
		expect(get(flash)).toBeNull();
	});
});
