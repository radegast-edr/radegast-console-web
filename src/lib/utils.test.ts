import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isDeviceActive, formatFullDateTime, matchesJsonata, mapSeverityToNumber } from './utils';

describe('utils', () => {
	describe('isDeviceActive', () => {
		beforeEach(() => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2026-06-03T07:00:00Z'));
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('returns false for null, undefined or empty string', () => {
			expect(isDeviceActive(null)).toBe(false);
			expect(isDeviceActive(undefined)).toBe(false);
			expect(isDeviceActive('')).toBe(false);
		});

		it('returns true if last seen is less than 10 minutes ago', () => {
			const nineMinutesAgo = '2026-06-03T06:51:00Z';
			expect(isDeviceActive(nineMinutesAgo)).toBe(true);
		});

		it('returns false if last seen is 10 minutes or more ago', () => {
			const tenMinutesAgo = '2026-06-03T06:50:00Z';
			expect(isDeviceActive(tenMinutesAgo)).toBe(false);
			const oneHourAgo = '2026-06-03T06:00:00Z';
			expect(isDeviceActive(oneHourAgo)).toBe(false);
		});

		it('handles string without timezone indicator (appends Z)', () => {
			// '2026-06-03T06:51:00' without Z -> should be parsed as UTC because cleanStr gets 'Z' appended
			const nineMinutesAgo = '2026-06-03T06:51:00';
			expect(isDeviceActive(nineMinutesAgo)).toBe(true);
		});

		it('handles Date objects', () => {
			const nineMinutesAgo = new Date('2026-06-03T06:51:00Z');
			expect(isDeviceActive(nineMinutesAgo)).toBe(true);
		});
	});

	describe('formatFullDateTime', () => {
		it('returns Never for null, undefined or empty string', () => {
			expect(formatFullDateTime(null)).toBe('Never');
			expect(formatFullDateTime(undefined)).toBe('Never');
			expect(formatFullDateTime('')).toBe('Never');
		});

		it('formats a date string correctly', () => {
			const dtStr = '2026-06-03T06:51:00Z';
			const formatted = formatFullDateTime(dtStr);
			expect(formatted).not.toBe('Never');
			expect(formatted).toContain('2026');
		});
	});

	describe('matchesJsonata', () => {
		const testObj = {
			meta: {
				device: 'MyLaptop',
				status: 'online'
			},
			alert: {
				event: 'malware_detected',
				severity: 'critical'
			}
		};

		it('returns true for empty query', async () => {
			expect(await matchesJsonata(testObj, '')).toBe(true);
			expect(await matchesJsonata(testObj, '   ')).toBe(true);
		});

		it('evaluates basic fields', async () => {
			expect(await matchesJsonata(testObj, 'meta.device = "MyLaptop"')).toBe(true);
			expect(await matchesJsonata(testObj, 'meta.device = "Other"')).toBe(false);
			expect(await matchesJsonata(testObj, 'alert.severity = "critical"')).toBe(true);
		});

		it('supports and, or, not operators and parentheses', async () => {
			expect(await matchesJsonata(testObj, 'meta.device = "MyLaptop" and alert.severity = "critical"')).toBe(true);
			expect(await matchesJsonata(testObj, 'meta.device = "MyLaptop" and alert.severity = "low"')).toBe(false);
			expect(await matchesJsonata(testObj, 'meta.device = "Other" or alert.severity = "critical"')).toBe(true);
			expect(await matchesJsonata(testObj, 'not(meta.status = "offline")')).toBe(true);
			expect(await matchesJsonata(testObj, '(meta.device = "MyLaptop" or meta.device = "Other") and alert.severity = "critical"')).toBe(true);
		});

		it('returns false for invalid jsonata query', async () => {
			expect(await matchesJsonata(testObj, 'invalid syntax ===')).toBe(false);
		});

		it('evaluates status and last_seen matching behavior', async () => {
			const onlineObj = {
				meta: {
					device: 'MyLaptop',
					status: 'online'
				},
				alert: {}
			};
			const offlineObj = {
				meta: {
					device: 'MyLaptop',
					status: 'offline',
					last_seen: 'June 3, 2026, 3:00 PM'
				},
				alert: {}
			};

			expect(await matchesJsonata(onlineObj, 'meta.status = "online"')).toBe(true);
			expect(await matchesJsonata(onlineObj, 'meta.status = "offline"')).toBe(false);
			expect(await matchesJsonata(onlineObj, 'meta.last_seen')).toBe(false);

			expect(await matchesJsonata(offlineObj, 'meta.status = "offline"')).toBe(true);
			expect(await matchesJsonata(offlineObj, 'meta.last_seen')).toBe(true);
			expect(await matchesJsonata(offlineObj, 'meta.last_seen = "June 3, 2026, 3:00 PM"')).toBe(true);
		});
	});

	describe('mapSeverityToNumber', () => {
		it('maps standard levels correctly', () => {
			expect(mapSeverityToNumber('trace')).toBe(1);
			expect(mapSeverityToNumber('debug')).toBe(1);
			expect(mapSeverityToNumber('info')).toBe(1);
			expect(mapSeverityToNumber('warn')).toBe(3);
			expect(mapSeverityToNumber('error')).toBe(4);
			expect(mapSeverityToNumber('fatal')).toBe(5);
		});

		it('maps custom/syslog levels correctly', () => {
			expect(mapSeverityToNumber('low')).toBe(2);
			expect(mapSeverityToNumber('medium')).toBe(3);
			expect(mapSeverityToNumber('med')).toBe(3);
			expect(mapSeverityToNumber('high')).toBe(4);
			expect(mapSeverityToNumber('critical')).toBe(5);
			expect(mapSeverityToNumber('crit')).toBe(5);
			expect(mapSeverityToNumber('alert')).toBe(5);
			expect(mapSeverityToNumber('emergency')).toBe(5);
			expect(mapSeverityToNumber('emerg')).toBe(5);
			expect(mapSeverityToNumber('notice')).toBe(1);
			expect(mapSeverityToNumber('warning')).toBe(3);
			expect(mapSeverityToNumber('informational')).toBe(1);
		});

		it('handles casing, spacing, and numbers', () => {
			expect(mapSeverityToNumber('  ERROR  ')).toBe(4);
			expect(mapSeverityToNumber('CRITICAL')).toBe(5);
			expect(mapSeverityToNumber('5')).toBe(5);
			expect(mapSeverityToNumber(3)).toBe(3);
			expect(mapSeverityToNumber(null)).toBe(0);
			expect(mapSeverityToNumber(undefined)).toBe(0);
			expect(mapSeverityToNumber('unknown')).toBe(0);
			
			// OpenTelemetry severity mapping checks
			expect(mapSeverityToNumber(9)).toBe(1);  // INFO (9-12) -> 1
			expect(mapSeverityToNumber('13')).toBe(3); // WARN (13-16) -> 3
			expect(mapSeverityToNumber(17)).toBe(4); // ERROR (17-20) -> 4
			expect(mapSeverityToNumber('21')).toBe(5); // FATAL (21-24) -> 5

			// Out-of-bounds numbers and invalid numeric strings
			expect(mapSeverityToNumber(0)).toBe(0);
			expect(mapSeverityToNumber(-1)).toBe(0);
			expect(mapSeverityToNumber(25)).toBe(0);
			expect(mapSeverityToNumber('100')).toBe(0);
			expect(mapSeverityToNumber('5a')).toBe(0);
		});
	});
});
