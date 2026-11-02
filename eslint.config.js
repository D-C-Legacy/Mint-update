const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const importPlugin = require('eslint-plugin-import');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
  {
    ignores: ['dist', 'node_modules', 'coverage', 'frontend', 'admin-portal'],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      import: importPlugin,
    },
    settings: {
      'import/resolver': {
        typescript: { project: './tsconfig.json' },
      },
    },
    rules: {
      ...tsPlugin.configs['recommended-requiring-type-checking'].rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/explicit-function-return-type': [
        'warn',
        { allowExpressions: true },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/modules/*/domain/**',
                '**/modules/*/infra/**',
                '**/modules/*/api/**',
              ],
              message:
                'Import another module only through its application/*.service.ts facade.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/modules/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@prisma/client'],
              message: 'Only infra/repositories may import Prisma types.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/modules/**/infra/repositories/**/*.ts', 'src/modules/**/infra/mappers/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  prettierConfig,
];
