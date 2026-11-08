import AsyncStorage from '@react-native-async-storage/async-storage'
import { Linking, Platform } from 'react-native'
import * as BackgroundTask from 'expo-background-task'
import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import * as TaskManager from 'expo-task-manager'

import { queryPower } from '../api/client'
import { loadPreferences } from '../storage/preferences'
import { appendHistory, type HistoryPoint } from '../storage/history'
import type { QueryPayload } from '../types/api'

export const HOURLY_MONITOR_TASK = 'ecust-power-hourly-monitor'
const NOTIFICATION_CHANNEL = 'low-power'
const UPDATE_NOTIFICATION_CHANNEL = 'app-updates'
const ONGOING_NOTIFICATION_CHANNEL = 'ongoing-power-status'

const ONGOING_NOTIFICATION_ID = 'ecust-ongoing-power'
const PREDICTIVE_NOTIFICATION_ID = 'ecust-predictive-low-power'
const MONITOR_STATE_KEY = '@ecust-power/monitor-state-v2'

export interface MonitorRuntimeState {
  alertedRoomKey: string | null
  alertedThreshold: number | null
  lastCheckedAt: string | null
  lastKwh: number | null
}

function getRoomKey(room: QueryPayload | null): string {
  if (!room) return ''
  return `${room.campus}/${room.building}/${room.room}`
}

function formatKwhText(kwh: number): string {
  return Number.isInteger(kwh) ? String(kwh) : kwh.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

export async function loadMonitorRuntimeState(): Promise<MonitorRuntimeState> {
  try {
    const raw = await AsyncStorage.getItem(MONITOR_STATE_KEY)
    if (!raw) {
      return {
        alertedRoomKey: null,
        alertedThreshold: null,
        lastCheckedAt: null,
        lastKwh: null
      }
    }
    const parsed = JSON.parse(raw) as Partial<MonitorRuntimeState>
    return {
      alertedRoomKey: typeof parsed.alertedRoomKey === 'string' ? parsed.alertedRoomKey : null,
      alertedThreshold: typeof parsed.alertedThreshold === 'number' ? parsed.alertedThreshold : null,
      lastCheckedAt: typeof parsed.lastCheckedAt === 'string' ? parsed.lastCheckedAt : null,
      lastKwh: typeof parsed.lastKwh === 'number' ? parsed.lastKwh : null
    }
  } catch {
    return {
      alertedRoomKey: null,
      alertedThreshold: null,
      lastCheckedAt: null,
      lastKwh: null
    }
  }
}

async function saveMonitorRuntimeState(state: MonitorRuntimeState): Promise<void> {
  try {
    await AsyncStorage.setItem(MONITOR_STATE_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage write errors in background task
  }
}

export async function resetMonitorAlertLock(): Promise<void> {
  const current = await loadMonitorRuntimeState()
  await saveMonitorRuntimeState({
    ...current,
    alertedRoomKey: null,
    alertedThreshold: null
  })
}

export async function ensureNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL, {
    name: '低电量紧急提醒',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 280, 200, 280],
    lightColor: '#FF3B30',
    enableVibrate: true,
    showBadge: true
  })
  await Notifications.setNotificationChannelAsync(ONGOING_NOTIFICATION_CHANNEL, {
    name: '常驻通知栏电量卡片',
    importance: Notifications.AndroidImportance.LOW,
    enableVibrate: false,
    showBadge: false
  })
  await Notifications.setNotificationChannelAsync(UPDATE_NOTIFICATION_CHANNEL, {
    name: '版本更新通知',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 180],
    lightColor: '#007AFF'
  })
}

export async function requestNotificationAccess(): Promise<boolean> {
  if (Platform.OS !== 'android') return false
  await ensureNotificationChannels()

  let permission = await Notifications.getPermissionsAsync()
  if (permission.status !== 'granted') {
    permission = await Notifications.requestPermissionsAsync()
  }
  return permission.status === 'granted'
}

export async function getRemotePushToken(): Promise<string | null> {
  if (Platform.OS !== 'android') return null

  try {
    await ensureNotificationChannels()
    const permission = await Notifications.getPermissionsAsync()
    if (permission.status !== 'granted') return null

    const projectId = Constants.expoConfig?.extra?.eas?.projectId
    if (!projectId) return null

    const token = await Notifications.getExpoPushTokenAsync({ projectId })
    return typeof token.data === 'string' ? token.data : null
  } catch {
    return null
  }
}

export async function sendLowPowerNotification(
  kwh: number,
  threshold: number,
  displayName?: string
): Promise<void> {
  await ensureNotificationChannels()
  const permission = await Notifications.getPermissionsAsync()
  if (permission.status !== 'granted') return

  const prefix = displayName ? `${displayName} ` : ''
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '宿舍低电量提醒',
      body: `${prefix}当前剩余 ${formatKwhText(kwh)} 度，已低于设定阈值 ${threshold} 度，请及时充电。`,
      sound: true,
      color: '#FF3B30',
      priority: Notifications.AndroidNotificationPriority.MAX,
      data: { type: 'low-power', kwh, threshold }
    },
    trigger: {
      channelId: NOTIFICATION_CHANNEL
    }
  })
}

export async function sendTestNotification(
  displayName?: string,
  currentKwh?: number | null,
  threshold = 15
): Promise<void> {
  const granted = await requestNotificationAccess()
  if (!granted) {
    throw new Error('请先在系统设置中允许通知权限')
  }

  const roomText = displayName || '华理宿舍电量监控'
  const kwhText = typeof currentKwh === 'number' && Number.isFinite(currentKwh)
    ? `当前剩余 ${formatKwhText(currentKwh)} 度（提醒阈值 ${threshold} 度）。`
    : `通知通道正常，低于 ${threshold} 度时将为您推送提醒。`

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '通知链路测试成功',
      body: `${roomText} · ${kwhText}`,
      sound: true,
      color: '#007AFF',
      priority: Notifications.AndroidNotificationPriority.MAX,
      data: { type: 'test-notification' }
    },
    trigger: {
      channelId: NOTIFICATION_CHANNEL
    }
  })
}

export async function updateOngoingPowerNotification(options: {
  enabled: boolean
  displayName: string
  kwh: number
  threshold: number
  estimatedDays?: number | null
  dailyAverage?: number | null
  updatedAt?: string
}): Promise<void> {
  if (Platform.OS !== 'android') return

  if (!options.enabled) {
    await dismissOngoingPowerNotification()
    return
  }

  await ensureNotificationChannels()
  const permission = await Notifications.getPermissionsAsync()
  if (permission.status !== 'granted') return

  const kwhText = formatKwhText(options.kwh)
  const statusTag = options.kwh <= options.threshold ? '低于阈值' : '监控中'
  const daysPart = typeof options.estimatedDays === 'number' && Number.isFinite(options.estimatedDays)
    ? ` · 预计可用 ${options.estimatedDays} 天`
    : ''
  const avgPart = typeof options.dailyAverage === 'number' && Number.isFinite(options.dailyAverage)
    ? ` · 日均 ${options.dailyAverage} 度`
    : ''

  await Notifications.scheduleNotificationAsync({
    identifier: ONGOING_NOTIFICATION_ID,
    content: {
      title: `${options.displayName} · 剩余 ${kwhText} 度`,
      body: `状态：${statusTag}（阈值 ${options.threshold} 度）${daysPart}${avgPart}`,
      sound: false,
      color: options.kwh <= options.threshold ? '#FF9500' : '#34C759',
      priority: Notifications.AndroidNotificationPriority.LOW,
      sticky: true,
      autoDismiss: false,
      data: { type: 'ongoing-status' }
    },
    trigger: {
      channelId: ONGOING_NOTIFICATION_CHANNEL
    }
  })
}

export async function dismissOngoingPowerNotification(): Promise<void> {
  if (Platform.OS !== 'android') return
  try {
    await Notifications.dismissNotificationAsync(ONGOING_NOTIFICATION_ID)
    await Notifications.cancelScheduledNotificationAsync(ONGOING_NOTIFICATION_ID)
  } catch {
    // Ignore if not present
  }
}

/**
 * 利用系统级 AlarmManager 调度预测性低电量提醒：
 * 即使 App 进程被系统彻底杀死，到达预计跌破阈值的时间点时，Android 系统仍会弹出提醒
 */
export async function syncPredictiveLowPowerAlarm(options: {
  enabled: boolean
  displayName: string
  currentKwh: number
  threshold: number
  dailyAverage: number | null
}): Promise<void> {
  if (Platform.OS !== 'android') return
  try {
    await Notifications.cancelScheduledNotificationAsync(PREDICTIVE_NOTIFICATION_ID)
  } catch {
    // Ignore
  }

  if (!options.enabled) return
  if (options.currentKwh <= options.threshold) return
  if (!options.dailyAverage || options.dailyAverage < 0.15) return

  const permission = await Notifications.getPermissionsAsync()
  if (permission.status !== 'granted') return

  const hourlyBurn = options.dailyAverage / 24
  const hoursUntilThreshold = (options.currentKwh - options.threshold) / hourlyBurn
  // 仅当预计在 1 小时 ~ 10 天内跌破阈值时注册系统级定时闹钟提醒
  if (hoursUntilThreshold < 1 || hoursUntilThreshold > 240) return

  const delaySeconds = Math.max(3600, Math.round(hoursUntilThreshold * 3600))
  await ensureNotificationChannels()
  await Notifications.scheduleNotificationAsync({
    identifier: PREDICTIVE_NOTIFICATION_ID,
    content: {
      title: '宿舍电量预计已达预警线',
      body: `${options.displayName} 按近期日均耗电（${options.dailyAverage}度/天）推算，当前剩余电量预计已接近或低于 ${options.threshold} 度，请打开应用核对并及时充电。`,
      sound: true,
      color: '#FF9500',
      priority: Notifications.AndroidNotificationPriority.HIGH,
      data: { type: 'predictive-low-power' }
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: delaySeconds,
      channelId: NOTIFICATION_CHANNEL
    }
  })
}

export async function openBatteryOptimizationSettings(): Promise<void> {
  if (Platform.OS !== 'android') return
  try {
    await Linking.sendIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS')
  } catch {
    try {
      await Linking.openSettings()
    } catch {
      // Ignore
    }
  }
}

export function shouldTriggerLowPowerAlert(
  currentKwh: number,
  threshold: number,
  roomKey: string,
  state: MonitorRuntimeState
): boolean {
  if (!roomKey || !Number.isFinite(currentKwh) || currentKwh > threshold) {
    return false
  }
  const alreadyAlertedForSameConfig =
    state.alertedRoomKey === roomKey && state.alertedThreshold === threshold
  return !alreadyAlertedForSameConfig
}

async function monitorOnce(): Promise<HistoryPoint[]> {
  const preferences = await loadPreferences()
  if (!preferences.myRoom || !preferences.monitoringEnabled) return []

  const data = await queryPower(preferences.myRoom)
  const points = await appendHistory(preferences.myRoom, data.kwh, data.updatedAt)
  const roomKey = getRoomKey(preferences.myRoom)
  const state = await loadMonitorRuntimeState()

  let nextAlertedRoomKey = state.alertedRoomKey
  let nextAlertedThreshold = state.alertedThreshold

  // 当电量回升超过阈值 + 1.5 度时，解除告警锁
  if (state.alertedRoomKey === roomKey && data.kwh > preferences.threshold + 1.5) {
    nextAlertedRoomKey = null
    nextAlertedThreshold = null
  }

  const triggerNow = shouldTriggerLowPowerAlert(
    data.kwh,
    preferences.threshold,
    roomKey,
    {
      ...state,
      alertedRoomKey: nextAlertedRoomKey,
      alertedThreshold: nextAlertedThreshold
    }
  )

  if (triggerNow && preferences.notificationsEnabled) {
    await sendLowPowerNotification(data.kwh, preferences.threshold, data.displayName)
    nextAlertedRoomKey = roomKey
    nextAlertedThreshold = preferences.threshold
  }

  await saveMonitorRuntimeState({
    alertedRoomKey: nextAlertedRoomKey,
    alertedThreshold: nextAlertedThreshold,
    lastCheckedAt: new Date().toISOString(),
    lastKwh: data.kwh
  })

  if (preferences.notificationsEnabled && preferences.ongoingNotificationEnabled) {
    await updateOngoingPowerNotification({
      enabled: true,
      displayName: data.displayName,
      kwh: data.kwh,
      threshold: preferences.threshold,
      updatedAt: data.updatedAt
    })
  }

  return points
}

if (!TaskManager.isTaskDefined(HOURLY_MONITOR_TASK)) {
  TaskManager.defineTask(HOURLY_MONITOR_TASK, async () => {
    try {
      await monitorOnce()
      return BackgroundTask.BackgroundTaskResult.Success
    } catch (error) {
      console.warn('低电量监控失败', error)
      return BackgroundTask.BackgroundTaskResult.Failed
    }
  })
}

export async function syncHourlyMonitor(enabled: boolean): Promise<void> {
  const registered = await TaskManager.isTaskRegisteredAsync(HOURLY_MONITOR_TASK)
  if (!enabled) {
    if (registered) await BackgroundTask.unregisterTaskAsync(HOURLY_MONITOR_TASK)
    await dismissOngoingPowerNotification()
    try {
      await Notifications.cancelScheduledNotificationAsync(PREDICTIVE_NOTIFICATION_ID)
    } catch {
      // Ignore
    }
    return
  }

  const available = await BackgroundTask.getStatusAsync()
  if (available !== BackgroundTask.BackgroundTaskStatus.Available) {
    throw new Error('后台监控不可用')
  }
  if (!registered) {
    await BackgroundTask.registerTaskAsync(HOURLY_MONITOR_TASK, { minimumInterval: 30 })
  }
}

export async function runMonitorNow(): Promise<HistoryPoint[]> {
  return monitorOnce()
}
