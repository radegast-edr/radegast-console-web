import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type ThemeType = 'light' | 'dark' | 'auto';

const THEME_KEY = 'radegast-theme';

// Read initial value from localStorage or default to 'auto'
const initialTheme: ThemeType = browser ? (localStorage.getItem(THEME_KEY) as ThemeType || 'auto') : 'auto';

export const theme = writable<ThemeType>(initialTheme);

if (browser) {
	theme.subscribe((value) => {
		localStorage.setItem(THEME_KEY, value);
		applyTheme(value);
	});

	window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
		const currentTheme = localStorage.getItem(THEME_KEY) as ThemeType;
		if (currentTheme === 'auto') {
			applyTheme('auto');
		}
	});
}

export function applyTheme(currentTheme: ThemeType) {
	if (!browser) return;
	const isDark = currentTheme === 'auto' 
		? window.matchMedia('(prefers-color-scheme: dark)').matches 
		: currentTheme === 'dark';
	
	document.documentElement.setAttribute('data-bs-theme', isDark ? 'dark' : 'light');
}
