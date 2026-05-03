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
    // `exhaustive-deps` remains 'warn' for Task #425: 5 highest-warning
    // files were fully triaged with real fixes, but 237 warnings across
    // 175 files require per-hook human review and could not be safely
    // resolved in a single pass. Tightening this rule to 'error' should
    // happen after the remaining warnings are individually triaged.
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    // Empty `catch {}` blocks are an intentional pattern across this codebase
    // for swallowing non-critical errors; keep flagging other empty blocks.
    'no-empty': ['error', { allowEmptyCatch: true }],
  },
}
