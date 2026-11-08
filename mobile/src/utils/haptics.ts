import { Platform, Vibration } from 'react-native'

/**
 * 极简触觉震动反馈（利用 Android 原生 VIBRATE 权限模拟短促刻度感）
 */
export function hapticTick(): void {
  if (Platform.OS !== 'android') return
  try {
    Vibration.vibrate(8)
  } catch {
    // 忽略部分设备不支持短震动的异常
  }
}

export function hapticLight(): void {
  if (Platform.OS !== 'android') return
  try {
    Vibration.vibrate(14)
  } catch {
    // Ignore
  }
}

export function hapticSuccess(): void {
  if (Platform.OS !== 'android') return
  try {
    Vibration.vibrate([0, 12, 45, 18])
  } catch {
    // Ignore
  }
}
