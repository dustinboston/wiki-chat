export default {
	rules: {
		// Next.js bundler resolves imports without extensions
		'import-x/extensions': 'off',

		// Next.js config files and API routes use process.env directly
		'n/prefer-global/process': 'off',

		// React, NextAuth, and drizzle all use null semantics
		'unicorn/no-null': 'off',
		// Allow null in type annotations — React, NextAuth, drizzle use null semantics
		'@typescript-eslint/no-restricted-types': 'off',

		// Next.js App Router exports uppercase HTTP method names (GET, POST, etc.)
		'@typescript-eslint/naming-convention': [
			'error',
			{
				selector: 'default',
				format: ['camelCase'],
			},
			{
				selector: 'variable',
				format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
			},
			{
				selector: 'typeLike',
				format: ['PascalCase'],
			},
			{
				selector: 'import',
				format: null,
			},
			{
				selector: 'function',
				format: ['camelCase', 'PascalCase'],
			},
			{
				selector: 'objectLiteralProperty',
				format: null,
			},
			{
				selector: 'typeProperty',
				format: null,
			},
			{
				// Allow UPPER_CASE for exported route handlers (GET, POST, DELETE)
				selector: 'variable',
				modifiers: ['exported', 'const'],
				format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
			},
		],
	},
	ignores: ['drizzle/**', '.next/**', 'build/**', 'coverage/**'],
};
