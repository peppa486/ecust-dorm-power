import { API_BASE } from './config'

function makeError(res) {
  const error = new Error(res.data?.error || `HTTP ${res.statusCode}`)
  error.statusCode = res.statusCode
  return error
}

export function request(path, options = {}) {
  const token = wx.getStorageSync('token') || ''
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE}${path}`,
      method: options.method || 'GET',
      data: options.data,
      header: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {})
      },
      timeout: 12000,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) return resolve(res.data)
        if (res.statusCode === 401) wx.removeStorageSync('token')
        reject(makeError(res))
      },
      fail: reject
    })
  })
}

export async function ensureLogin(force = false) {
  if (!force && wx.getStorageSync('token')) return
  const login = await new Promise((resolve, reject) => wx.login({ success: resolve, fail: reject }))
  const data = await request('/api/auth/login', { method: 'POST', data: { code: login.code } })
  wx.setStorageSync('token', data.token)
}

export async function authRequest(path, options = {}) {
  await ensureLogin()
  try {
    return await request(path, options)
  } catch (error) {
    if (error.statusCode !== 401) throw error
    await ensureLogin(true)
    return request(path, options)
  }
}
