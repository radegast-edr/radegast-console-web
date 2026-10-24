import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-static';
import { defineConfig } from 'vitest/config';
import { svelteTesting } from '@testing-library/svelte/vite';
import Icons from 'unplugin-icons/vite';
import path from 'node:path';

export default defineConfig({
	plugins: [
		sveltekit({
			adapter: adapter({
				fallback: 'index.html'
			}),
			paths: {
				base: '/ui'
			}
		}),
		svelteTesting(),
		Icons({
			compiler: 'svelte'
		})
	],
	server: {
		port: 5173,
		proxy: {
			'/api': {
				target: 'http://localhost:8000',
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/api/, '')
			}
		}
	},
	resolve: {
		conditions: ['browser'],
		alias: {
			$lib: path.resolve('./src/lib')
		}
	},
	test: {
		environment: 'jsdom',
		environmentOptions: {
			jsdom: {
				url: 'http://localhost:3000'
			}
		},
		globals: true,
		setupFiles: ['./src/setupTests.ts']
	}
});
