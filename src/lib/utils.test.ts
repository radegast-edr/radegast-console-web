import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isDeviceActive, formatFullDateTime } from './utils';

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
});
