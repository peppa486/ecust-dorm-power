import { useEffect } from 'react'
import * as Notifications from 'expo-notifications'
import { StatusBar } from 'expo-status-bar'
import { Linking } from 'react-native'

import './src/monitoring/background'
import { PowerQueryScreen } from './src/screens/PowerQueryScreen'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
})

function getUpdateUrl(response: Notifications.NotificationResponse): string | null {
  const data = response.notification.request.content.data
  if (!data || typeof data !== 'object') return null
  const candidate = data as Record<string, unknown>
  if (candidate.type !== 'app-update' || typeof candidate.downloadUrl !== 'string') return null
  return candidate.downloadUrl.startsWith('https://') ? candidate.downloadUrl : null
}

function openUpdateFromNotification(response: Notifications.NotificationResponse): void {
  const url = getUpdateUrl(response)
  if (url) void Linking.openURL(url).catch(() => undefined)
}

export default function App() {
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(openUpdateFromNotification)
    void Notifications.getLastNotificationResponseAsync().then(response => {
      if (!response) return
      openUpdateFromNotification(response)
      void Notifications.clearLastNotificationResponseAsync().catch(() => undefined)
    })
    return () => subscription.remove()
  }, [])

  return (
    <>
      <StatusBar style="dark" />
      <PowerQueryScreen />
    </>
  )
}
