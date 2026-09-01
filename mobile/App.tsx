import * as Notifications from 'expo-notifications'
import { StatusBar } from 'expo-status-bar'

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

export default function App() {
  return (
    <>
      <StatusBar style="dark" />
      <PowerQueryScreen />
    </>
  )
}
