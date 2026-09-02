import { Platform } from 'react-native'
import * as BackgroundTask from 'expo-background-task'
import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import * as TaskManager from 'expo-task-manager'

import { queryPower } from '../api/client'
import { loadPreferences } from '../storage/preferences'
import { appendHistory, type HistoryPoint } from '../storage/history'

export const HOURLY_MONITOR_TASK = 'ecust-power-hourly-monitor'
const NOTIFICATION_CHANNEL = 'low-power'
const UPDATE_NOTIFICATION_CHANNEL = 'app-updates'

export async function ensureNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL, {
    name: '低电量提醒',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#c27619'
  })
  await Notifications.setNotificationChannelAsync(UPDATE_NOTIFICATION_CHANNEL, {
    name: '版本更新',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 180],
    lightColor: '#1c1f24'
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
    // Push credentials are optional for local monitoring; the server still samples.
    return null
  }
}

export async function sendLowPowerNotification(kwh: number, threshold: number): Promise<void> {
  await ensureNotificationChannels()
  const permission = await Notifications.getPermissionsAsync()
  if (permission.status !== 'granted') return

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '低电量提醒',
      body: `当前剩余 ${kwh.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')} 度，已低于 ${threshold} 度。`,
      sound: true,
      color: '#c27619',
      priority: Notifications.AndroidNotificationPriority.HIGH
    },
    trigger: {
      channelId: NOTIFICATION_CHANNEL
    }
  })
}

async function monitorOnce(): Promise<HistoryPoint[]> {
  const preferences = await loadPreferences()
  if (!preferences.myRoom || !preferences.monitoringEnabled) return []

  const data = await queryPower(preferences.myRoom)
  const points = await appendHistory(preferences.myRoom, data.kwh, data.updatedAt)
  const previous = points.length > 1 ? points.at(-2) : undefined
  const crossedThreshold = data.kwh <= preferences.threshold
    && (!previous || previous.kwh > preferences.threshold)

  if (crossedThreshold && preferences.notificationsEnabled) {
    await sendLowPowerNotification(data.kwh, preferences.threshold)
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
    return
  }

  const available = await BackgroundTask.getStatusAsync()
  if (available !== BackgroundTask.BackgroundTaskStatus.Available) {
    throw new Error('后台监控不可用')
  }
  if (!registered) {
    await BackgroundTask.registerTaskAsync(HOURLY_MONITOR_TASK, { minimumInterval: 60 })
  }
}

export async function runMonitorNow(): Promise<HistoryPoint[]> {
  return monitorOnce()
}
