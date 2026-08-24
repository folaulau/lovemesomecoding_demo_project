// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

/*
 * eslint-config-expo already brings the TypeScript-aware rules, including a
 * `@typescript-eslint/no-unused-vars` that understands type positions. Re-enabling the BASE
 * `no-unused-vars` on top of it produces a false positive for every named parameter in a function
 * TYPE — `(product: Product) => void` looks like an unused binding to it — so it is left off.
 */
module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'e2e/*', '.expo/*', 'coverage/*', 'expo-env.d.ts'],
  },
]);
