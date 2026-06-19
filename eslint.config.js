import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

export default ts.config(
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs['flat/recommended'],
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node
			}
		}
	},
	{
		files: ['**/*.ts', '**/*.svelte.ts'],
		languageOptions: {
			parser: ts.parser
		}
	},
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parserOptions: {
				parser: ts.parser
			}
		}
	},
	{
		rules: {
			// Restrictive/strict rule set
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
			'@typescript-eslint/no-explicit-any': 'off', // Disabled: raw decrypted payloads / dynamic objects use 'any'
			'@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
			'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
			'eqeqeq': ['error', 'always', { null: 'ignore' }],
			'no-var': 'error',
			'no-undef': 'off', // Disabled: TypeScript and svelte-check handle undefined reference checks
			'prefer-const': 'off', // Disabled in favor of Svelte-aware version
			'svelte/prefer-const': [
				'error',
				{
					destructuring: 'any',
					excludedRunes: ['$props', '$derived']
				}
			],
			'svelte/no-navigation-without-resolve': 'off', // Disabled because we use {base} path prefixes natively
			'svelte/require-each-key': 'off', // Disabled: simple read-only each lists do not require keys
			'svelte/prefer-svelte-reactivity': 'off', // Disabled: standard JS Map/Set is fine for local non-reactive usage
			'svelte/no-at-html-tags': 'off', // Disabled: required for rendering syntax-highlighted and decrypted telemetry HTML
			'svelte/valid-compile': 'error',
			'svelte/no-unused-svelte-ignore': 'error'
		}
	},
	{
		files: ['**/*.test.ts'],
		rules: {
			'@typescript-eslint/no-require-imports': 'off'
		}
	},
	{
		ignores: [
			'build/',
			'.svelte-kit/',
			'dist/',
			'node_modules/',
			'static/', // Vendor files (e.g. wasm_exec.js)
			'src/lib/openapi.d.ts' // Generated file
		]
	}
);
