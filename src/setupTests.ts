import '@testing-library/jest-dom';
import { vi } from 'vitest';

Element.prototype.animate = vi.fn().mockReturnValue({
	finished: Promise.resolve(),
	cancel: vi.fn(),
	commitStyles: vi.fn()
});

Object.defineProperty(window, 'matchMedia', {
	writable: true,
	value: vi.fn().mockImplementation((query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: vi.fn(),
		removeListener: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn()
	}))
});

const createStorageMock = () => {
	let store: Record<string, string> = {};
	return {
		getItem: (key: string) => (key in store ? store[key] : null),
		setItem: (key: string, value: string) => {
			store[key] = String(value);
		},
		removeItem: (key: string) => {
			delete store[key];
		},
		clear: () => {
			store = {};
		},
		get length() {
			return Object.keys(store).length;
		},
		key: (index: number) => Object.keys(store)[index] || null
	};
};

const localStorageMock = createStorageMock();
const sessionStorageMock = createStorageMock();

Object.defineProperty(globalThis, 'localStorage', {
	value: localStorageMock,
	writable: true,
	configurable: true
});

Object.defineProperty(globalThis, 'sessionStorage', {
	value: sessionStorageMock,
	writable: true,
	configurable: true
});

if (typeof window !== 'undefined') {
	Object.defineProperty(window, 'localStorage', {
		value: localStorageMock,
		writable: true,
		configurable: true
	});
	Object.defineProperty(window, 'sessionStorage', {
		value: sessionStorageMock,
		writable: true,
		configurable: true
	});
}


