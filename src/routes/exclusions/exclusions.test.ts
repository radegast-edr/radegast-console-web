import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/svelte';
import { api } from '$lib/api';
import { askConfirm } from '$lib/confirm';
import { showFlash } from '$lib/store';
import Exclusions from './+page.svelte';

vi.mock('$app/paths', () => ({
	base: '',
	resolve: (path: string) => (!path ? '' : path.startsWith('/') ? path : '/' + path),
	asset: (path: string) => path
}));

vi.mock('$app/navigation', () => ({
	goto: vi.fn()
}));

vi.mock('$lib/confirm', () => ({
	askConfirm: vi.fn().mockResolvedValue(true)
}));

vi.mock('$lib/crypto', () => ({
	initAgeWasm: vi.fn().mockResolvedValue(undefined),
	getStoredPrivateKey: vi.fn().mockResolvedValue('user_private_key'),
	decrypt: vi.fn((cipher: string) => cipher.replace('cipher:', '')),
	encrypt: vi.fn((plain: string, keys: string[]) => `cipher:${plain}|${keys.join(',')}`)
}));

vi.mock('$lib/store', () => {
	const { writable } = require('svelte/store');
	return {
		user: writable({ id: 10, extended_edr_enabled: false }),
		showError: vi.fn(),
		showFlash: vi.fn()
	};
});

vi.mock('$lib/api', () => ({
	ApiError: class ApiError extends Error {
		status: number;
		constructor(message: string, status: number) {
			super(message);
			this.status = status;
		}
	},
	api: {
		me: vi.fn(),
		listGroups: vi.fn(),
		getGroup: vi.fn(),
		listExclusions: vi.fn(),
		createSharedExclusion: vi.fn(),
		deleteExclusion: vi.fn(),
		getExclusionRecipients: vi.fn(),
		applyExclusionToGroup: vi.fn(),
		removeExclusionFromGroup: vi.fn(),
		updateExclusion: vi.fn()
	}
}));

const groupDetails: Record<number, any> = {
	1: { id: 1, name: 'Servers', public_key: 'k1', private_key: 'cipher:g1', devices: [], user_has_pack_write: true },
	2: { id: 2, name: 'Laptops', public_key: 'k2', private_key: 'cipher:g2', devices: [], user_has_pack_write: true },
	3: { id: 3, name: 'Read only', public_key: 'k3', private_key: 'cipher:g3', devices: [], user_has_pack_write: false }
};

function exclusion(overrides: Record<string, unknown> = {}) {
	return {
		id: 7,
		name: 'cipher:Ignore backups',
		jsonata_query: 'cipher:rule.name = "backup"',
		description: null,
		created_at: '2026-11-01T10:00:00Z',
		alert_id: null,
		exclusion_type: 'hard',
		encrypted: true,
		version: 2,
		groups: [
			{ id: 1, name: 'Servers' },
			{ id: 2, name: 'Laptops' }
		],
		group_count: 2,
		can_edit: true,
		last_change: {
			action: 'applied',
			at: '2026-11-02T10:00:00Z',
			by_user_id: 10,
			by_email: 'alice@example.com',
			group_id: 2,
			group_name: 'Laptops'
		},
		...overrides
	};
}

describe('Exclusions library page', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(api.me).mockResolvedValue({ id: 10 } as any);
		vi.mocked(api.listGroups).mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }] as any);
		vi.mocked(api.getGroup).mockImplementation(async (id: number) => groupDetails[id]);
		vi.mocked(askConfirm).mockResolvedValue(true);
	});

	it('shows decrypted exclusions with their groups and last change', async () => {
		vi.mocked(api.listExclusions).mockResolvedValue([exclusion()] as any);
		render(Exclusions);

		await waitFor(() => {
			expect(screen.getByText('Ignore backups')).toBeInTheDocument();
		});
		expect(screen.getByText('rule.name = "backup"')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Servers' })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Laptops' })).toBeInTheDocument();
		expect(screen.getByText('Applied to Laptops')).toBeInTheDocument();
		expect(screen.getByText(/alice@example\.com/)).toBeInTheDocument();
	});

	it('shows groups the user cannot access as a count and hides edit actions', async () => {
		vi.mocked(api.listExclusions).mockResolvedValue([
			exclusion({ groups: [{ id: 1, name: 'Servers' }], group_count: 3, can_edit: false })
		] as any);
		render(Exclusions);

		await waitFor(() => {
			expect(screen.getByText('+2 other')).toBeInTheDocument();
		});
		expect(screen.queryByLabelText('Edit')).toBeNull();
		expect(screen.queryByLabelText('Delete from all groups')).toBeNull();
	});

	it('removes an encrypted exclusion from one group by re-encrypting for the others', async () => {
		vi.mocked(api.listExclusions).mockResolvedValue([exclusion()] as any);
		vi.mocked(api.getExclusionRecipients).mockResolvedValue({ version: 2, public_keys: ['k1', 'k2'] });
		vi.mocked(api.removeExclusionFromGroup).mockResolvedValue({ message: 'ok', deleted: false });
		render(Exclusions);

		await waitFor(() => {
			expect(screen.getByLabelText('Remove from Laptops')).toBeInTheDocument();
		});
		await fireEvent.click(screen.getByLabelText('Remove from Laptops'));

		await waitFor(() => {
			expect(api.removeExclusionFromGroup).toHaveBeenCalledWith(7, 2, {
				version: 2,
				name: 'cipher:Ignore backups|k1',
				jsonata_query: 'cipher:rule.name = "backup"|k1',
				description: null
			});
			expect(showFlash).toHaveBeenCalledWith('Exclusion removed from Laptops');
		});
	});

	it('applies an exclusion to another writable group', async () => {
		vi.mocked(api.listExclusions).mockResolvedValue([
			exclusion({ groups: [{ id: 1, name: 'Servers' }], group_count: 1 })
		] as any);
		vi.mocked(api.getExclusionRecipients).mockResolvedValue({ version: 2, public_keys: ['k1'] });
		vi.mocked(api.applyExclusionToGroup).mockResolvedValue(exclusion() as any);
		render(Exclusions);

		await waitFor(() => {
			expect(screen.getByLabelText('Apply to another group')).toBeInTheDocument();
		});
		await fireEvent.click(screen.getByLabelText('Apply to another group'));

		const select = screen.getByLabelText('Device Group') as HTMLSelectElement;
		// Only writable groups that do not have the exclusion yet are offered
		expect(Array.from(select.options).map((o) => o.textContent)).toEqual(['Select a group...', 'Laptops']);
		await fireEvent.change(select, { target: { value: '2' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

		await waitFor(() => {
			expect(api.applyExclusionToGroup).toHaveBeenCalledWith(7, 2, {
				version: 2,
				name: 'cipher:Ignore backups|k1,k2',
				jsonata_query: 'cipher:rule.name = "backup"|k1,k2',
				description: null
			});
		});
	});

	it('deletes an exclusion from all groups', async () => {
		vi.mocked(api.listExclusions).mockResolvedValue([exclusion()] as any);
		vi.mocked(api.deleteExclusion).mockResolvedValue({ message: 'Exclusion deleted', deleted: true });
		render(Exclusions);

		await waitFor(() => {
			expect(screen.getByLabelText('Delete from all groups')).toBeInTheDocument();
		});
		await fireEvent.click(screen.getByLabelText('Delete from all groups'));

		await waitFor(() => {
			expect(askConfirm).toHaveBeenCalledWith('Are you sure you want to delete the exclusion "Ignore backups" from all 2 groups?');
			expect(api.deleteExclusion).toHaveBeenCalledWith(7);
		});
	});
});
