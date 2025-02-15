import resolve from '@rollup/plugin-node-resolve';
import typescript from 'rollup-plugin-typescript2';

export default {
  input: ['src/config-template-card.ts'],
  output: {
    dir: './dist',
    format: 'es',
  },
  plugins: [
    resolve(),
    typescript(),
  ], treeshake: false,
  moduleContext: {
    // intl-utils is deprecated but still used by custom-card-helpers.
    // Until it is removed from custom-card-helpers, silence a Rollup warning related to it:
    // https://rollupjs.org/troubleshooting/#error-this-is-undefined
    'node_modules/@formatjs/intl-utils/lib/src/diff.js': 'window',
    'node_modules/@formatjs/intl-utils/lib/src/resolve-locale.js': 'window',
  },
};
