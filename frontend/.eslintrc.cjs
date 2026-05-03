module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    // Catch React hook bugs automatically before they crash pages.
    // `rules-of-hooks` is an error so misplaced hooks block merges.
    // `exhaustive-deps` is also an error after Task #425 baseline freeze:
    // every existing offender was annotated with an inline disable comment
    // tagged `Task #425`, so any new violation is a real regression that
    // should block CI rather than silently accumulate.
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    // Empty `catch {}` blocks are an intentional pattern across this codebase
    // for swallowing non-critical errors; keep flagging other empty blocks.
    'no-empty': ['error', { allowEmptyCatch: true }],
  },
}
