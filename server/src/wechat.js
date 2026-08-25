import axios from 'axios'
import { buildingLabel } from './buildings.js'

let tokenCache = { token: '', expiresAt: 0 }
let tokenRequest = null

async function requestAccessToken() {
  const appid = process.env.WECHAT_APPID
  const secret = process.env.WECHAT_SECRET
  if (!appid || !secret) throw new Error('微信服务端配置不完整')

  const { data } = await axios.get('https://api.weixin.qq.com/cgi-bin/token', {
    params: { grant_type: 'client_credential', appid, secret },
    timeout: 10000
  })
  if (!data.access_token) throw new Error(data.errmsg || '获取微信 access_token 失败')
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in || 7200) * 1000
  }
  return tokenCache.token
}

async function getAccessToken() {
  if (tokenCache.token && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token
  if (!tokenRequest) {
    tokenRequest = requestAccessToken().finally(() => {
      tokenRequest = null
    })
  }
  return tokenRequest
}

function lowPowerData(watch, kwh) {
  const roomField = process.env.WECHAT_FIELD_ROOM || 'thing1'
  const powerField = process.env.WECHAT_FIELD_POWER || 'number2'
  const tipField = process.env.WECHAT_FIELD_TIP || 'thing3'
  return {
    [roomField]: { value: `${watch.campus}${buildingLabel(watch.campus, watch.building)} ${watch.room}`.slice(0, 20) },
    [powerField]: { value: (powerField.startsWith('number') ? String(kwh) : `${kwh} 度`).slice(0, 20) },
    [tipField]: { value: `低于 ${watch.threshold} 度，请及时充值`.slice(0, 20) }
  }
}

async function sendRequest(accessToken, openid, watch, kwh, templateId) {
  const { data } = await axios.post(
    `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${encodeURIComponent(accessToken)}`,
    {
      touser: openid,
      template_id: templateId,
      page: 'pages/index/index',
      miniprogram_state: process.env.WECHAT_MINIPROGRAM_STATE || 'formal',
      lang: 'zh_CN',
      data: lowPowerData(watch, kwh)
    },
    { timeout: 10000 }
  )
  return data
}

export class WeChatSendError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`)
    this.name = 'WeChatSendError'
    this.code = Number(code)
  }
}

export async function sendLowPower(openid, watch, kwh) {
  const templateId = process.env.WECHAT_LOW_POWER_TEMPLATE_ID
  if (!templateId) throw new Error('未配置低电量订阅模板')

  let accessToken = await getAccessToken()
  let data = await sendRequest(accessToken, openid, watch, kwh, templateId)
  if ([40014, 42001].includes(Number(data.errcode))) {
    tokenCache = { token: '', expiresAt: 0 }
    accessToken = await getAccessToken()
    data = await sendRequest(accessToken, openid, watch, kwh, templateId)
  }
  if (data.errcode) throw new WeChatSendError(data.errcode, data.errmsg || '订阅消息发送失败')
  return data
}
