/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  base: './',
  plugins: [svelte(), viteSingleFile()],
  test: {
    include: ['core/**/*.test.ts', 'app/**/*.test.ts'],
    environment: 'node',
    // Eigenschaftstests (100–150 Zufallsfälle) brauchen lokal ~2 s; auf CI-Runnern Luft lassen.
    testTimeout: 30000,
  },
});
