import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import ExclusionModal from './ExclusionModal.svelte';
import { api } from '$lib/api';

vi.mock('$lib/api', () => {
	return {
		api: {
			getGroup: vi.fn()
		}
	};
});

describe('ExclusionModal Component', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('shows green E2EE alert when group devices are all supported', async () => {
		vi.mocked(api.getGroup).mockResolvedValue({
			id: 1,
			name: 'E2EE Group',
			devices: [
				{ id: 101, name: 'Device-1', agent_version: 'python 0.5.0' },
				{ id: 102, name: 'Device-2', agent_version: 'python 0.6.1' }
			]
		} as any);

		render(ExclusionModal, {
			props: {
				show: true,
				selectedGroupId: 1,
				name: 'Test Exclusion',
				query: 'rule.name = "Test"',
				description: 'Desc',
				onClose: () => {},
				onSave: () => {}
			}
		});

		await waitFor(() => {
			expect(screen.getByText(/End-to-End Encrypted/)).toBeInTheDocument();
			expect(screen.queryByText(/Not E2EE/)).toBeNull();
		});
	});

	it('shows orange warning alert when at least one group device is unsupported', async () => {
		vi.mocked(api.getGroup).mockResolvedValue({
			id: 1,
			name: 'Legacy Group',
			devices: [
				{ id: 101, name: 'Device-1', agent_version: 'python 0.4.9' },
				{ id: 102, name: 'Device-2', agent_version: 'python 0.5.0' }
			]
		} as any);

		render(ExclusionModal, {
			props: {
				show: true,
				selectedGroupId: 1,
				name: 'Test Exclusion',
				query: 'rule.name = "Test"',
				description: 'Desc',
				onClose: () => {},
				onSave: () => {}
			}
		});

		await waitFor(() => {
			expect(screen.getByText(/Not E2EE/)).toBeInTheDocument();
			expect(screen.queryByText(/End-to-End Encrypted/)).toBeNull();
		});
	});

	it('shows orange warning alert when group device agent version is unknown', async () => {
		vi.mocked(api.getGroup).mockResolvedValue({
			id: 1,
			name: 'Unknown Group',
			devices: [
				{ id: 101, name: 'Device-1', agent_version: 'unknown' }
			]
		} as any);

		render(ExclusionModal, {
			props: {
				show: true,
				selectedGroupId: 1,
				name: 'Test Exclusion',
				query: 'rule.name = "Test"',
				description: 'Desc',
				onClose: () => {},
				onSave: () => {}
			}
		});

		await waitFor(() => {
			expect(screen.getByText(/Not E2EE/)).toBeInTheDocument();
		});
	});

	it('allows editing an E2EE exclusion but keeps the encryption checkbox disabled', async () => {
		vi.mocked(api.getGroup).mockResolvedValue({
			id: 1,
			name: 'E2EE Group',
			devices: []
		} as any);

		render(ExclusionModal, {
			props: {
				show: true,
				title: 'Edit Exclusion',
				selectedGroupId: 1,
				name: 'Decrypted Exclusion',
				query: 'rule.name = "Decrypted"',
				description: 'DecryptedDesc',
				encrypted: true,
				isEditMode: true,
				onClose: () => {},
				onSave: () => {}
			}
		});

		await waitFor(() => {
			expect(screen.getByText('Edit Exclusion')).toBeInTheDocument();
			expect(screen.getByLabelText('Name')).not.toBeDisabled();
			expect(screen.getByLabelText('JSONata Query')).not.toBeDisabled();
			expect(screen.getByLabelText('Description')).not.toBeDisabled();
			expect(screen.getByText('Update Exclusion')).toBeInTheDocument();
			expect(screen.getByLabelText('Encrypt this exclusion (End-to-End Encrypted)')).toBeDisabled();
		});
	});
});
