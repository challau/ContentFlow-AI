// ESLint 9 flat config.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '*.config.js', '*.config.mjs'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        // tsconfig.check.json is the project that covers src, test and prisma.
        // The build config deliberately excludes tests, so it cannot be used here.
        project: ['./tsconfig.check.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Decorator metadata and Prisma's JSON types make some assertions
      // unavoidable; require an explanation rather than banning them.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      // NestJS constructor parameter properties are declared but never "used"
      // in a way ESLint can see.
      'no-unused-private-class-members': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    // Tests and the seed script legitimately use non-null assertions and console.
    files: ['**/*.spec.ts', 'test/**/*.ts', 'prisma/seed.ts', 'src/cli/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
