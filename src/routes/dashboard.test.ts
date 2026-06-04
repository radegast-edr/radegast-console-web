import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import { api } from '$lib/api';
import { user } from '$lib/store';
import { getStoredPrivateKey } from '$lib/crypto';
import Dashboard from './+page.svelte';

vi.mock('$app/paths', () => ({
	base: ''
}));

vi.mock('$app/navigation', () => ({
	goto: vi.fn()
}));

vi.mock('$lib/api', () => ({
	api: {
		me: vi.fn(),
		listTeams: vi.fn(),
		listGroups: vi.fn(),
		listDevices: vi.fn(),
		getUnreadLogsCount: vi.fn(),
		listTeamDevices: vi.fn(),
		getGroup: vi.fn(),
		listLogs: vi.fn()
	}
}));

vi.mock('$lib/crypto', () => ({
	getStoredPrivateKey: vi.fn()
}));

vi.mock('$lib/store', () => {
	const { writable } = require('svelte/store');
	return {
		user: writable(null)
	};
});

describe('Dashboard Component', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		
		vi.mocked(api.me).mockResolvedValue({
			id: 1,
			email: 'admin@example.com',
			role: 'admin',
			verified: true,
			extended_edr_enabled: false
		} as any);
		vi.mocked(api.listTeams).mockResolvedValue([
			{ id: 1, name: 'Team Alpha' }
		] as any);
		vi.mocked(api.listGroups).mockResolvedValue([
			{ id: 1, name: 'Servers' }
		] as any);
		vi.mocked(api.listDevices).mockResolvedValue([
			{ id: 10, name: 'Server-01', last_seen: '2026-06-04T04:28:00Z' },
			{ id: 11, name: 'Server-02', last_seen: '2026-06-04T04:28:00Z' }
		] as any);
		vi.mocked(api.getUnreadLogsCount).mockResolvedValue({ unread_count: 5 });
		vi.mocked(api.listTeamDevices).mockResolvedValue([
			{ id: 10 }
		] as any);
		vi.mocked(api.getGroup).mockResolvedValue({
			id: 1,
			name: 'Servers',
			devices: [{ id: 10 }, { id: 11 }]
		} as any);
		vi.mocked(api.listLogs).mockResolvedValue([
			{ id: 1, severity: 'critical', alert_resolution: null, seen: false, device_id: 10 },
			{ id: 2, severity: 'high', alert_resolution: null, seen: false, device_id: 10 },
			{ id: 3, severity: 'medium', alert_resolution: 'true_positive', seen: true, device_id: 10 },
			{ id: 4, severity: 'low', alert_resolution: 'false_positive', seen: true, device_id: 11 },
			{ id: 5, severity: 'informational', alert_resolution: null, seen: false, device_id: 11 }
		] as any);
		vi.mocked(getStoredPrivateKey).mockResolvedValue('fake_private_key');
	});

	it('renders overview metrics correctly', async () => {
		user.set({
			id: 1,
			email: 'admin@example.com',
			role: 'admin',
			verified: true,
			extended_edr_enabled: false
		} as any);

		render(Dashboard);

		await waitFor(() => {
			expect(screen.getByText('Total Devices')).toBeInTheDocument();
			expect(screen.getByText('2')).toBeInTheDocument(); // device length
			expect(screen.getByText('Active Alerts')).toBeInTheDocument();
			// Active Alerts now shows the client-side computed resolutionCounts.unread (3 unread logs out of 5 logs).
			expect(screen.getByText('3')).toBeInTheDocument();
			expect(screen.getByText('Total Teams')).toBeInTheDocument();
			expect(screen.getByText('1')).toBeInTheDocument(); // team length
		});
	});

	it('displays Alert Severity Distribution on the dashboard', async () => {
		user.set({
			id: 1,
			email: 'admin@example.com',
			role: 'admin',
			verified: true,
			extended_edr_enabled: false
		} as any);

		render(Dashboard);

		await waitFor(() => {
			expect(screen.getByText('Alert Severity Distribution')).toBeInTheDocument();
			expect(screen.getByText('critical')).toBeInTheDocument();
			expect(screen.getByText('high')).toBeInTheDocument();
			expect(screen.getByText('medium')).toBeInTheDocument();
		});
	});

	it('hides Alert Resolution Distribution if extended_edr_enabled is false', async () => {
		user.set({
			id: 1,
			email: 'admin@example.com',
			role: 'admin',
			verified: true,
			extended_edr_enabled: false
		} as any);

		render(Dashboard);

		await waitFor(() => {
			expect(screen.queryByText('Alert Resolution Distribution')).toBeNull();
		});
	});

	it('shows Alert Resolution Distribution if extended_edr_enabled is true', async () => {
		vi.mocked(api.me).mockResolvedValue({
			id: 1,
			email: 'admin@example.com',
			role: 'admin',
			verified: true,
			extended_edr_enabled: true
		} as any);

		user.set({
			id: 1,
			email: 'admin@example.com',
			role: 'admin',
			verified: true,
			extended_edr_enabled: true
		} as any);

		render(Dashboard);

		await waitFor(() => {
			expect(screen.getByText('Alert Resolution Distribution')).toBeInTheDocument();
			expect(screen.getByText('Unread (New)')).toBeInTheDocument();
			expect(screen.getByText('True Positive')).toBeInTheDocument();
			expect(screen.getByText('False Positive')).toBeInTheDocument();
		});
	});

	it('displays Alert Distribution by Group and Alert Distribution by Team', async () => {
		user.set({
			id: 1,
			email: 'admin@example.com',
			role: 'admin',
			verified: true,
			extended_edr_enabled: false
		} as any);

		render(Dashboard);

		await waitFor(() => {
			expect(screen.getByText('Alert Distribution by Group')).toBeInTheDocument();
			expect(screen.getByText('Alert Distribution by Team')).toBeInTheDocument();
		});
	});
});
