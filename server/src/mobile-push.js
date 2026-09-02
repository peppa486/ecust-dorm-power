import axios from 'axios'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
const EXPO_TOKEN_PATTERN = /^(?:Expo|Exponent)PushToken\[[^\]]+\]$/

export class MobilePushError extends Error {
  constructor(code, message, cause) {
    super(message)
    this.name = 'MobilePushError'
    this.code = code
    this.cause = cause
  }
}

async function sendExpoNotification(pushToken, message) {
  if (typeof pushToken !== 'string' || !EXPO_TOKEN_PATTERN.test(pushToken)) {
    throw new MobilePushError('InvalidPushToken', '移动推送令牌无效')
  }

  const headers = { 'content-type': 'application/json' }
  if (process.env.EXPO_ACCESS_TOKEN) {
    headers.authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`
  }

  let response
  try {
    response = await axios.post(EXPO_PUSH_URL, {
      to: pushToken,
      ...message,
      sound: 'default',
      priority: 'high',
      channelId: message.channelId || 'app-updates'
    }, { headers, timeout: 10000 })
  } catch (cause) {
    throw new MobilePushError('PushUnavailable', '移动推送服务暂时不可用', cause)
  }

  const result = response?.data?.data || response?.data
  if (result?.status === 'error') {
    throw new MobilePushError(result.details?.error || 'PushFailed', result.message || '移动推送发送失败')
  }
  return result
}

export async function sendMobileNotification(pushToken, watch, kwh) {
  const value = Number(kwh).toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
  return sendExpoNotification(pushToken, {
    title: '华理宿舍电量提醒',
    body: `${watch.displayName} 当前剩余 ${value} 度，已低于 ${watch.threshold} 度。`,
    data: { type: 'low-power', campus: watch.campus, building: watch.building, room: watch.room },
    channelId: 'low-power'
  })
}

export async function sendMobileUpdateNotification(pushToken, update) {
  return sendExpoNotification(pushToken, {
    title: `华理宿舍电量查询有新版本 ${update.version}`,
    body: update.releaseNotes || '点击查看并下载最新版。',
    data: {
      type: 'app-update',
      version: update.version,
      versionCode: update.versionCode,
      downloadUrl: update.downloadUrl,
      forceUpdate: update.forceUpdate
    },
    channelId: 'app-updates'
  })
}
