import fs from 'node:fs'
import path from 'node:path'

import { defineConfig } from 'vitest/config'

const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    globals: true,
    environment: 'node',
    execArgv: ['--no-experimental-webstorage'],
    setupFiles: ['test/setup.js'],
    include: ['test/**/*.test.{js,jsx,mjs,ts,tsx}', 'src/**/*.test.{js,jsx,ts,tsx}'],
    exclude: ['dist', 'node_modules'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**'],
      exclude: ['dist', 'node_modules', '**/*.test.*', '**/*.spec.*', '**/README.md', '**/*.d.ts', 'src/components/ui/**', 'src/io/live2d/**'],
      thresholds: {
        statements: 65,
        branches: 56,
        functions: 60,
        lines: 70,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
})
