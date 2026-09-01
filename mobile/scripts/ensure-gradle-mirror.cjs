'use strict';

const fs = require('node:fs');
const path = require('node:path');

const mobileRoot = path.resolve(__dirname, '..');
const mirrors = [
  {
    url: 'https://maven.aliyun.com/repository/google',
    call: 'google',
  },
  {
    url: 'https://maven.aliyun.com/repository/public',
    call: 'mavenCentral',
  },
];
function collectGradleFiles(root) {
  if (!fs.existsSync(root)) return [];

  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const filePath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '.gradle' || entry.name === 'build' || entry.name === 'dist') continue;
      files.push(...collectGradleFiles(filePath));
    } else if (entry.name === 'build.gradle' || entry.name === 'settings.gradle' || entry.name.endsWith('.gradle.kts')) {
      files.push(filePath);
    }
  }
  return files;
}

const targets = [
  ...collectGradleFiles(path.join(mobileRoot, 'android')),
  ...collectGradleFiles(path.join(mobileRoot, 'node_modules')),
];

function addMirrorBeforeCalls(source, call, url, declaration) {
  const compactPattern = new RegExp(`repositories \\{[ \\t]*${call}\\(\\)[ \\t]*\\}`, 'g');
  let updated = source.replace(
    compactPattern,
    `repositories {\n  ${declaration}\n  ${call}()\n}`,
  );

  const lines = updated.split(/\r?\n/);
  const output = [];
  for (const line of lines) {
    const callOnLine = line.includes(`${call}()`);
    const alreadyDeclared = line.includes(url) || output.at(-1)?.includes(url);
    if (callOnLine && !alreadyDeclared && !line.includes('repositories {')) {
      const indent = line.match(/^[ \t]*/)?.[0] ?? '';
      output.push(`${indent}${declaration}`);
    }
    output.push(line);
  }

  return output.join('\n');
}

for (const filePath of targets) {
  let source = fs.readFileSync(filePath, 'utf8');
  let updated = source;
  const kotlinDsl = filePath.endsWith('.kts');

  for (const { url, call } of mirrors) {
    const declaration = kotlinDsl
      ? `maven { url = uri("${url}") }`
      : `maven { url '${url}' }`;
    updated = addMirrorBeforeCalls(updated, call, url, declaration);
  }

  if (updated !== source) fs.writeFileSync(filePath, updated);
}
