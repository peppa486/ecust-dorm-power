import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const files = ['src', 'test', 'scripts'].flatMap(directory => {
  const fullPath = path.join(root, directory)
  return fs.readdirSync(fullPath)
    .filter(file => file.endsWith('.js') || file.endsWith('.mjs'))
    .map(file => path.join(fullPath, file))
})

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' })
  if (result.error || result.status !== 0) process.exit(result.status || 1)
}
