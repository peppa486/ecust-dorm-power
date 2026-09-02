function required(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`缺少环境变量 ${name}`)
  return value
}

const apiUrl = (process.env.MOBILE_UPDATE_API_URL || 'https://power.ecust.cc').replace(/\/$/, '')
const adminToken = required('MOBILE_UPDATE_ADMIN_TOKEN')
const payload = {
  version: required('UPDATE_VERSION'),
  versionCode: Number(required('UPDATE_VERSION_CODE')),
  downloadUrl: required('UPDATE_DOWNLOAD_URL'),
  releaseNotes: process.env.UPDATE_RELEASE_NOTES || '',
  forceUpdate: /^(1|true|yes)$/i.test(process.env.UPDATE_FORCE_UPDATE || 'false')
}

if (process.env.UPDATE_SHA256) payload.sha256 = process.env.UPDATE_SHA256
if (process.env.UPDATE_PUBLISHED_AT) payload.publishedAt = process.env.UPDATE_PUBLISHED_AT

const response = await fetch(`${apiUrl}/api/admin/mobile-update`, {
  method: 'POST',
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminToken}`
  },
  body: JSON.stringify(payload)
})

const body = await response.json().catch(() => null)
if (!response.ok) {
  throw new Error(body?.error || `更新推送失败（HTTP ${response.status}）`)
}

console.log(JSON.stringify({
  version: body?.update?.version,
  notified: body?.notified ?? 0,
  invalidTokens: body?.invalidTokens ?? 0,
  failed: body?.failed ?? 0
}))
