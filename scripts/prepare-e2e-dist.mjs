import { cpSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const source = resolve('test/fixtures/phaser-atlas-contract')
const target = resolve('dist/test/fixtures/phaser-atlas-contract')

if (!existsSync(resolve('dist/index.html'))) {
  throw new Error('Production build is missing; run npm run build first')
}

cpSync(source, target, { recursive: true })
console.log('E2E fixtures copied into production build')
