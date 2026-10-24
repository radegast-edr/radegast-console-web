declare module '@fontsource/open-sans';
declare module 'hack-font';

/// <reference types="unplugin-icons/types/svelte" />

declare module '$app/paths' {
	export const base: string;
	export const assets: string;
	export function resolve(route: string, params?: Record<string, string>): string;
	export function asset(path: string): string;
	export function match(url: URL | string): Promise<any>;
}
