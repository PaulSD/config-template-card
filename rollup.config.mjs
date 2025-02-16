import { nodeResolve } from '@rollup/plugin-node-resolve';
import eslint from '@rollup/plugin-eslint';
import typescript from '@rollup/plugin-typescript';

const watch = process.env.ROLLUP_WATCH;

export default {
  input: ['src/config-template-card.ts'],
  output: {
    dir: './dist',
    format: 'es',
    sourcemap: true,
  },
  plugins: [
    nodeResolve(),
    eslint({
      throwOnError: false,
    }),
    typescript({
      noEmitOnError: true,
    }),
    watch && serve({
      contentBase: './dist',
      host: '0.0.0.0',
      port: 5000,
      allowCrossOrigin: true,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    }),
  ], treeshake: false,
  moduleContext: {
    // intl-utils is deprecated but still used by custom-card-helpers.
    // Until it is removed from custom-card-helpers, silence a Rollup warning related to it:
    // https://rollupjs.org/troubleshooting/#error-this-is-undefined
    'node_modules/@formatjs/intl-utils/lib/src/diff.js': 'window',
    'node_modules/@formatjs/intl-utils/lib/src/resolve-locale.js': 'window',
  },
};
