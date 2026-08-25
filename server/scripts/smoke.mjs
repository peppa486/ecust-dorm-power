import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const root = process.cwd()
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecust-dorm-power-'))
const port = 18_000 + Math.floor(Math.random() * 1_000)
const child = spawn(process.execPath, ['src/index.js'], {
  cwd: root,
  env: {
    ...process.env,
    NODE_ENV: 'test',
    PORT: String(port),
    DB_PATH: path.join(tempDir, 'power.sqlite'),
    WECHAT_APPID: '',
    WECHAT_SECRET: ''
  },
  stdio: ['ignore', 'pipe', 'pipe']
})

let output = ''
child.stdout.on('data', chunk => { output += chunk.toString() })
child.stderr.on('data', chunk => { output += chunk.toString() })
const exit = new Promise(resolve => child.once('exit', resolve))

async function waitForHealth() {
  const deadline = Date.now() + 8_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`服务提前退出：${output}`)
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`)
      if (response.ok) return
    } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`健康检查超时：${output}`)
}

try {
  await waitForHealth()
  console.log('server smoke ok')
} finally {
  if (child.exitCode === null) child.kill('SIGTERM')
  await Promise.race([exit, new Promise(resolve => setTimeout(resolve, 3_000))])
  fs.rmSync(tempDir, { recursive: true, force: true })
}
