import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from '$lib/api';
import { LogManager } from './logManager.svelte';

vi.mock('$lib/api', () => ({
	api: {
		me: vi.fn(),
		listDevices: vi.fn(),
		listLogs: vi.fn(),
		markLogSeen: vi.fn()
	}
}));

vi.mock('$lib/crypto', () => ({
	initAgeWasm: vi.fn(),
	getStoredPrivateKey: vi.fn(),
	decrypt: vi.fn()
}));

describe('LogManager Logic', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(api.me).mockResolvedValue({ id: 1, email: 'admin@example.com' } as any);
		vi.mocked(api.listDevices).mockResolvedValue([]);
		vi.mocked(api.listLogs).mockResolvedValue([]);
	});

	it('uses unencrypted severity as default for meta.severity and severity_number', async () => {
		const logManager = new LogManager(null);
		
		const log = {
			id: 42,
			device_id: 1,
			time: '2026-06-03T16:20:00Z',
			severity: 'high',
			content: 'encrypted_content',
			seen: false,
			signature: 'sig'
		} as any;

		logManager.logs = [log];
		const alertObj = logManager.getAlertObject(log);

		expect(alertObj.meta.severity).toBe('high');
		expect(alertObj.meta.severity_number).toBe(4);
	});

	it('prefers decrypted severity over unencrypted severity', async () => {
		const logManager = new LogManager('fake_key');
		
		const log = {
			id: 43,
			device_id: 1,
			time: '2026-06-03T16:20:00Z',
			severity: 'high',
			content: 'encrypted_content',
			seen: false,
			signature: 'sig'
		} as any;

		logManager.logs = [log];
		logManager.decryptionState[log.id] = { success: true, parsed: { severity: 'low' } };
		
		const alertObj = logManager.getAlertObject(log);

		expect(alertObj.meta.severity).toBe('low');
		expect(alertObj.meta.severity_number).toBe(2);
	});
});
