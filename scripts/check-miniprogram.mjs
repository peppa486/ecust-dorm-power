import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const miniprogramRoot = path.join(root, 'miniprogram')
const failures = []

function walk(directory) {
  const files = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...walk(file))
    else files.push(file)
  }
  return files
}

function relative(file) {
  return path.relative(root, file).replaceAll(path.sep, '/')
}

function checkJson(file) {
  try {
    JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    failures.push(`${relative(file)}: invalid JSON (${error.message})`)
  }
}

function checkJavaScript(file) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' })
  if (result.status !== 0) {
    failures.push(`${relative(file)}: invalid JavaScript\n${result.stderr.trim()}`)
  }
}

function checkWxml(file) {
  const source = fs.readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '')
  const tagPattern = /<\s*(\/?)\s*([A-Za-z][\w:-]*)(?:\s+[^<>]*?)?\s*(\/?)\s*>/g
  const selfClosing = new Set(['input', 'image', 'icon', 'slider', 'switch', 'checkbox', 'radio', 'textarea'])
  const stack = []
  let match

  while ((match = tagPattern.exec(source))) {
    const [, closing, name, explicitSelfClosing] = match
    if (closing) {
      const actual = stack.pop()
      if (actual !== name) {
        failures.push(`${relative(file)}: mismatched WXML tag, expected </${actual || 'none'}> but found </${name}>`)
        return
      }
    } else if (!explicitSelfClosing && !selfClosing.has(name)) {
      stack.push(name)
    }
  }

  if (stack.length) failures.push(`${relative(file)}: unclosed WXML tag <${stack.at(-1)}>`)
}

const allFiles = walk(miniprogramRoot)
for (const file of allFiles) {
  if (file.endsWith('.js')) checkJavaScript(file)
  if (file.endsWith('.json')) checkJson(file)
  if (file.endsWith('.wxml')) checkWxml(file)
}

const projectConfig = path.join(root, 'project.config.json')
checkJson(projectConfig)
const project = JSON.parse(fs.readFileSync(projectConfig, 'utf8'))
if (!project.appid || project.appid === 'touristappid') failures.push('project.config.json: release AppID is not configured')
if (project.setting?.urlCheck !== true) failures.push('project.config.json: setting.urlCheck must be true for release')

const apiConfigFile = path.join(miniprogramRoot, 'utils', 'config.js')
const apiConfig = fs.readFileSync(apiConfigFile, 'utf8')
if (!/export\s+const\s+API_ENV\s*=\s*['"]production['"]/.test(apiConfig)) {
  failures.push('miniprogram/utils/config.js: API_ENV must be production for release')
}
const productionUrl = apiConfig.match(/production\s*:\s*['"]([^'"]+)['"]/)?.[1]
if (!productionUrl || !productionUrl.startsWith('https://') || productionUrl.includes('example.com')) {
  failures.push('miniprogram/utils/config.js: production API must be a real HTTPS URL')
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log(`mini program check ok: ${allFiles.filter(file => file.endsWith('.js')).length} JS, ${allFiles.filter(file => file.endsWith('.json')).length} JSON, ${allFiles.filter(file => file.endsWith('.wxml')).length} WXML`)
