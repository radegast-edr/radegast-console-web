import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/svelte';
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

	describe('multi-group mode', () => {
		const groups = [
			{ id: 1, name: 'Servers' },
			{ id: 2, name: 'Laptops' }
		] as any;

		function mockGroups(details: Record<number, any>) {
			vi.mocked(api.getGroup).mockImplementation(async (id: number) => details[id]);
		}

		it('renders a checkbox per group and selects groups', async () => {
			mockGroups({
				1: { id: 1, name: 'Servers', public_key: 'k1', private_key: 'p1', devices: [] },
				2: { id: 2, name: 'Laptops', public_key: 'k2', private_key: 'p2', devices: [] }
			});
			render(ExclusionModal, {
				props: {
					show: true,
					multiGroup: true,
					groups,
					selectedGroupIds: [1],
					name: 'Shared',
					query: 'rule.name = "x"',
					description: '',
					onClose: () => {},
					onSave: () => {}
				}
			});

			const servers = screen.getByLabelText('Servers') as HTMLInputElement;
			const laptops = screen.getByLabelText('Laptops') as HTMLInputElement;
			expect(servers.checked).toBe(true);
			expect(laptops.checked).toBe(false);

			await fireEvent.click(laptops);
			await waitFor(() => {
				expect(laptops.checked).toBe(true);
				expect(api.getGroup).toHaveBeenCalledWith(2);
				expect(screen.getByText(/all devices in the target groups support it/)).toBeInTheDocument();
			});
		});

		it('disables submit when no group is selected', async () => {
			render(ExclusionModal, {
				props: {
					show: true,
					multiGroup: true,
					groups,
					selectedGroupIds: [],
					name: 'Shared',
					query: 'rule.name = "x"',
					description: '',
					onClose: () => {},
					onSave: () => {}
				}
			});
			expect(screen.getByText('Create Exclusion', { selector: 'button' })).toBeDisabled();
		});

		it('warns about selected groups without encryption keys', async () => {
			mockGroups({
				1: { id: 1, name: 'Servers', public_key: 'k1', private_key: 'p1', devices: [] },
				2: { id: 2, name: 'Laptops', public_key: null, private_key: null, devices: [] }
			});
			render(ExclusionModal, {
				props: {
					show: true,
					multiGroup: true,
					groups,
					selectedGroupIds: [1, 2],
					name: 'Shared',
					query: 'rule.name = "x"',
					description: '',
					onClose: () => {},
					onSave: () => {}
				}
			});
			await waitFor(() => {
				expect(screen.getByText(/no encryption keys set up: Laptops/)).toBeInTheDocument();
			});
		});
	});
});

