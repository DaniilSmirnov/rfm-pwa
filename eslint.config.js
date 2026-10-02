import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import importPlugin from 'eslint-plugin-import';
import react from 'eslint-plugin-react';

export default [
  {
    ignores: [
      'dist/**',
      '.vite-public/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'public/vendor/**',
    ],
  },
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.serviceworker,
        ...globals.worker,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { 'react-hooks': reactHooks, import: importPlugin, react },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': [
        'error',
        {
          args: 'none',
          caughtErrors: 'none',
          varsIgnorePattern: '^_',
        },
      ],
      'import/no-unresolved': 'error',
      'import/no-duplicates': 'error',
      'import/named': 'error',
      'import/default': 'error',
      'import/namespace': 'error',
      'no-duplicate-imports': 'error',
      'no-duplicate-case': 'error',
      'no-unreachable': 'error',
      'no-unsafe-finally': 'error',
      'no-self-assign': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='document'][property.name='body']",
          message: 'React UI must not mutate document.body; use React state and props.',
        },
        {
          selector: "MemberExpression[property.name='classList']",
          message: 'React UI must not mutate classList; use React className.',
        },
        {
          selector: "MemberExpression[property.name='dataset']",
          message: 'React UI must not mutate dataset; use React data-* props.',
        },
        {
          selector: "CallExpression[callee.property.name='setAttribute']",
          message: 'React UI must not call setAttribute; use JSX attributes.',
        },
      ],
    },
  },
  {
    files: ['vite.config.js', 'vitest.config.js', 'playwright*.config.js'],
    rules: {
      // These packages expose config entry points through package exports that
      // eslint-plugin-import's Node resolver does not currently follow.
      'import/no-unresolved': 'off',
    },
  },
];
