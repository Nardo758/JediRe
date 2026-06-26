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
    // `exhaustive-deps` is 'error' after Task #425 triage — every
    // existing case has been either fixed (real dep additions /
    // useCallback / memoization) or annotated with a hook-specific
    // eslint-disable-next-line and a per-warning rationale documenting
    // the intentional closure semantics. New stale-closure regressions
    // will block the build.
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    // Empty `catch {}` blocks silently swallow failures — Task #426
    // converted every existing empty catch to a `logSwallowedError`
    // call so failures leave a console trace for debugging. New empty
    // catches now block the build.
    'no-empty': 'error',
    // Catch duplicate variable/const declarations before they break the
    // Vite build. The TS-aware rule supersedes the base ESLint rule so
    // that TypeScript type declarations are handled correctly.
    'no-redeclare': 'off',
    '@typescript-eslint/no-redeclare': 'error',
  },
}
