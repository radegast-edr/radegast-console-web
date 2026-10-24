import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	PUBLIC_BACKEND_URL: {
		public: true,
		static: true,
		schema: (value) => value ?? ''
	}
});
