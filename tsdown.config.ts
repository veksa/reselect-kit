import fs from 'node:fs/promises';
import path from 'node:path';
import { defineConfig, type UserConfig } from 'tsdown';

async function writeCommonJSEntry() {
  await fs.writeFile(
    path.join('dist/cjs/', 'index.js'),
    `'use strict'
if (process.env.NODE_ENV === 'production') {
  module.exports = require('./reselectKit.production.min.cjs')
} else {
  module.exports = require('./reselectKit.development.cjs')
}`,
  );
}

const commonOptions = {
  entry: { reselectKit: 'src/index.ts' },
  sourcemap: true,
  target: 'esnext',
  unbundle: false,
  clean: false,
} satisfies UserConfig;

export default defineConfig([
  {
    ...commonOptions,
    name: 'Modern ESM',
    target: 'es2019',
    format: 'esm',
    outExtensions: () => ({ js: '.mjs', dts: '.d.ts' }),
    dts: true,
    clean: true,
  },
  {
    ...commonOptions,
    name: 'CJS Development',
    entry: { 'reselectKit.development': 'src/index.ts' },
    env: { NODE_ENV: 'development' },
    format: 'cjs',
    outDir: './dist/cjs/',
    outExtensions: () => ({ js: '.cjs' }),
    dts: false,
  },
  {
    ...commonOptions,
    name: 'CJS Production',
    entry: { 'reselectKit.production.min': 'src/index.ts' },
    env: { NODE_ENV: 'production' },
    format: 'cjs',
    outDir: './dist/cjs/',
    outExtensions: () => ({ js: '.cjs' }),
    minify: true,
    dts: false,
    onSuccess: writeCommonJSEntry,
  },
]);
