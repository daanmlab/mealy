import { config as reactConfig } from '@repo/eslint-config/react-internal';

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...reactConfig,
  {
    rules: {
      // TypeScript already enforces prop types
      'react/prop-types': 'off',
    },
  },
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'babel.config.js',
      'metro.config.js',
      'tailwind.config.js',
    ],
  },
];
