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
      'public/vendor/**'
    ]
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
        ...globals.worker
      },
      parserOptions: {
        ecmaFeatures: { jsx: true }
      }
    },
    plugins: { 'react-hooks': reactHooks, import: importPlugin, react },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', {
        args: 'none',
        caughtErrors: 'none',
        varsIgnorePattern: '^_'
      }],
      'import/no-unresolved': 'error',
      'import/named': 'error',
      'import/default': 'error',
      'import/namespace': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error'
    }
  },
  {
    files: ['vite.config.js', 'vitest.config.js', 'playwright*.config.js'],
    rules: {
      // These packages expose config entry points through package exports that
      // eslint-plugin-import's Node resolver does not currently follow.
      'import/no-unresolved': 'off'
    }
  }
];
