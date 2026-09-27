import { describe, it, expect } from 'vitest';
import {
	getCategoryDisplay,
	getOsIcon,
	getProviderName,
	getOperationName,
	getDirectionLabel,
	getPrimaryCategory,
	formatAlertTimestamp,
	getSeverityClass,
	getAlertField,
	getAlertNumber,
	getAlertArray,
	getAlertBoolean,
	getAlertObject,
	formatDedupCount,
	getYaraSourceLabel,
	getIntegrityBadgeClass
} from './alertHelpers';

describe('alertHelpers', () => {
	it('maps categories to icons and labels', () => {
		expect(getCategoryDisplay('process').label).toBe('Process');
		expect(getCategoryDisplay('file').label).toBe('File');
		expect(getCategoryDisplay('network').label).toBe('Network');
		expect(getCategoryDisplay('registry').label).toBe('Registry');
		expect(getCategoryDisplay('unknown_cat').label).toBe('unknown_cat');
	});

	it('maps OS types to icons', () => {
		expect(getOsIcon('windows')).toContain('windows');
		expect(getOsIcon('linux')).toContain('tux');
	});

	it('maps providers and operations', () => {
		expect(getProviderName('ebpf')).toBe('eBPF');
		expect(getProviderName('etw')).toBe('ETW');
		expect(getProviderName('custom')).toBe('custom');

		expect(getOperationName('start')).toBe('Process Start');
		expect(getOperationName('creation')).toBe('Creation');

		expect(getDirectionLabel('egress')).toContain('Egress');
		expect(getDirectionLabel('ingress')).toContain('Ingress');
		expect(getDirectionLabel('custom')).toBe('custom');
	});

	it('extracts primary category', () => {
		expect(getPrimaryCategory({ 'event.category': ['process', 'network'] })).toBe('process');
		expect(getPrimaryCategory({})).toBe('unknown');
	});

	it('formats timestamps', () => {
		const formatted = formatAlertTimestamp('2026-09-27T05:00:00Z');
		expect(formatted).toBe('2026-09-27 05:00:00 UTC');
	});

	it('maps severity classes', () => {
		expect(getSeverityClass('high')).toContain('bg-danger');
		expect(getSeverityClass('critical')).toContain('bg-danger');
		expect(getSeverityClass('medium')).toContain('bg-warning');
		expect(getSeverityClass('low')).toContain('bg-warning');
	});

	it('safely extracts fields with getAlertField, getAlertNumber, getAlertArray', () => {
		const alert = {
			'rule.name': 'Test Rule',
			'process.pid': 1234,
			'tags': ['attack.execution', 'cve'],
			'is_flagged': true,
			'meta_obj': { author: 'Sigma' }
		};

		expect(getAlertField(alert, 'rule.name')).toBe('Test Rule');
		expect(getAlertField(alert, 'nonexistent')).toBeUndefined();

		expect(getAlertNumber(alert, 'process.pid')).toBe(1234);
		expect(getAlertNumber(alert, 'rule.name')).toBeUndefined();

		expect(getAlertArray(alert, 'tags')).toEqual(['attack.execution', 'cve']);
		expect(getAlertArray(alert, 'rule.name')).toBeUndefined();
	});

	it('safely extracts boolean with getAlertBoolean', () => {
		expect(getAlertBoolean({ test: true }, 'test')).toBe(true);
		expect(getAlertBoolean({ test: false }, 'test')).toBe(false);
		expect(getAlertBoolean({ test: 'true' }, 'test')).toBe(true);
		expect(getAlertBoolean({ test: 'false' }, 'test')).toBe(false);
		expect(getAlertBoolean({ test: 'other' }, 'test')).toBeUndefined();
		expect(getAlertBoolean({}, 'test')).toBeUndefined();
	});

	it('safely extracts object with getAlertObject', () => {
		const obj = { key: 'val' };
		expect(getAlertObject({ test: obj }, 'test')).toEqual(obj);
		expect(getAlertObject({ test: 'str' }, 'test')).toBeUndefined();
		expect(getAlertObject({ test: [1, 2] }, 'test')).toBeUndefined();
		expect(getAlertObject({ test: null }, 'test')).toBeUndefined();
		expect(getAlertObject({}, 'test')).toBeUndefined();
	});

	it('formats deduplication count', () => {
		expect(formatDedupCount(undefined)).toBeNull();
		expect(formatDedupCount(0)).toBeNull();
		expect(formatDedupCount(-1)).toBeNull();
		expect(formatDedupCount(5)).toBe('+5 repeats');
	});

	it('formats YARA source labels', () => {
		expect(getYaraSourceLabel(undefined)).toBeNull();
		expect(getYaraSourceLabel('process_memory')).toBe('Process Memory');
		expect(getYaraSourceLabel('file')).toBe('File');
		expect(getYaraSourceLabel('custom')).toBe('custom');
	});

	it('maps integrity levels', () => {
		expect(getIntegrityBadgeClass('System')).toContain('bg-danger');
		expect(getIntegrityBadgeClass('high')).toContain('bg-danger');
		expect(getIntegrityBadgeClass('medium')).toContain('bg-warning');
		expect(getIntegrityBadgeClass('low')).toContain('bg-info');
		expect(getIntegrityBadgeClass(undefined)).toContain('bg-secondary');
	});
});
