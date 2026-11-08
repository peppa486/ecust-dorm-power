import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  AppState,
  Linking,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native'

import {
  ApiError,
  getBuildings,
  getMobileHistory,
  getMobileUpdate,
  queryPower,
  registerMobileDevice,
  registerMobileWatch,
  removeMobileWatch
} from '../api/client'
import { BuildingPickerModal } from '../components/BuildingPickerModal'
import { EnergyAnalyticsCard } from '../components/EnergyAnalyticsCard'
import { HeroTelemetryCard } from '../components/HeroTelemetryCard'
import { MonitorCard } from '../components/MonitorCard'
import { PatternInsightsCard } from '../components/PatternInsightsCard'
import { QueryCard } from '../components/QueryCard'
import { RoomSwitcherModal } from '../components/RoomSwitcherModal'
import { StateCard } from '../components/StateCard'
import { UpdateCard } from '../components/UpdateCard'
import {
  getRemotePushToken,
  loadMonitorRuntimeState,
  openBatteryOptimizationSettings,
  requestNotificationAccess,
  resetMonitorAlertLock,
  runMonitorNow,
  sendTestNotification,
  syncHourlyMonitor,
  syncPredictiveLowPowerAlarm,
  updateOngoingPowerNotification
} from '../monitoring/background'
import { appendHistory, clearHistory, loadHistory, type HistoryPoint } from '../storage/history'
import { getMobileInstallationToken } from '../storage/mobileIdentity'
import {
  createDefaultPreferences,
  loadPreferences,
  MAX_THRESHOLD,
  MIN_THRESHOLD,
  normalizeThreshold,
  savePreferences,
  type RoomSelection,
  type StoredPreferences
} from '../storage/preferences'
import {
  CAMPUSES,
  type BuildingOption,
  type Campus,
  type MobileHistoryPoint,
  type MobileHistoryResponse,
  type MobileUpdate,
  type PowerResult,
  type QueryPayload
} from '../types/api'
import { colors, radii, spacing } from '../theme'
import { getInstalledAppVersion, isUpdateAvailable } from '../update/version'
import { analyzePowerHistory, buildDemoPowerHistory, type ServerHistoryStats } from '../utils/analytics'
import { hapticLight, hapticSuccess, hapticTick } from '../utils/haptics'
import { isValidRoom, normalizeRoomInput } from '../utils/power'

type CampusMap<T> = Record<Campus, T>

function createCampusMap<T>(factory: () => T): CampusMap<T> {
  return {
    奉贤: factory(),
    徐汇: factory()
  }
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}

function selectionFor(preferences: StoredPreferences, campus: Campus): RoomSelection {
  return preferences.selections[campus] || { building: '', room: '' }
}

function sameRoom(left: QueryPayload | null, right: QueryPayload | null): boolean {
  return Boolean(left && right)
    && left?.campus === right?.campus
    && left?.building === right?.building
    && left?.room === right?.room
}

function roomPayload(campus: Campus, building: string, room: string): QueryPayload | null {
  if (!building || !room) return null
  return { campus, building, room }
}

function asHistoryPoints(items: MobileHistoryPoint[]): HistoryPoint[] {
  return items.map(item => ({
    kwh: item.kwh,
    createdAt: item.createdAt,
    recharged: item.recharged
  }))
}

function mergeHistory(...lists: HistoryPoint[][]): HistoryPoint[] {
  const byKey = new Map<string, HistoryPoint>()
  for (const list of lists) {
    for (const point of list) {
      byKey.set(`${point.createdAt}:${point.kwh}`, point)
    }
  }
  return Array.from(byKey.values())
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))
    .slice(-336)
}

export function PowerQueryScreen() {
  const [preferences, setPreferences] = useState<StoredPreferences>(() => createDefaultPreferences())
  const [hydrating, setHydrating] = useState(true)
  const [campus, setCampus] = useState<Campus>(CAMPUSES[0])
  const [selectedBuilding, setSelectedBuilding] = useState('')
  const [room, setRoom] = useState('')
  const [buildingsByCampus, setBuildingsByCampus] = useState<CampusMap<BuildingOption[]>>(() => createCampusMap(() => []))
  const [buildingsLoading, setBuildingsLoading] = useState<CampusMap<boolean>>(() => createCampusMap(() => false))
  const [buildingsErrors, setBuildingsErrors] = useState<CampusMap<string | null>>(() => createCampusMap(() => null))
  const [queryLoading, setQueryLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [queryError, setQueryError] = useState<string | null>(null)
  const [result, setResult] = useState<PowerResult | null>(null)
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [serverStats, setServerStats] = useState<ServerHistoryStats | null>(null)
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null)
  const [monitorError, setMonitorError] = useState<string | null>(null)
  const [monitorFeedback, setMonitorFeedback] = useState<string | null>(null)
  const [monitorBusy, setMonitorBusy] = useState(false)
  const [testingNotification, setTestingNotification] = useState(false)
  const [pickerVisible, setPickerVisible] = useState(false)
  const [roomSheetVisible, setRoomSheetVisible] = useState(false)
  const [demoPreviewEnabled, setDemoPreviewEnabled] = useState(false)
  const [availableUpdate, setAvailableUpdate] = useState<MobileUpdate | null>(null)
  const [updateBusy, setUpdateBusy] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)

  const mountedRef = useRef(true)
  const campusRef = useRef<Campus>(CAMPUSES[0])
  const preferencesRef = useRef(preferences)
  const buildingRequestIds = useRef<CampusMap<number>>({ 奉贤: 0, 徐汇: 0 })
  const persistenceQueue = useRef<Promise<void>>(Promise.resolve())
  const mobileTokenRef = useRef<string | null>(null)
  const dismissedUpdateVersionRef = useRef<string | null>(null)
  const toggleSeqRef = useRef(0)
  const toggleChainRef = useRef<Promise<void>>(Promise.resolve())
  const thresholdSeqRef = useRef(0)

  campusRef.current = campus
  preferencesRef.current = preferences

  const queueSave = useCallback((next: StoredPreferences) => {
    const operation = persistenceQueue.current
      .catch(() => undefined)
      .then(() => savePreferences(next))
    persistenceQueue.current = operation.catch(() => undefined)
  }, [])

  const updatePreferences = useCallback((patch: Partial<StoredPreferences>): StoredPreferences => {
    const next: StoredPreferences = {
      ...preferencesRef.current,
      ...patch
    }
    preferencesRef.current = next
    setPreferences(next)
    queueSave(next)
    return next
  }, [queueSave])

  const updateSelection = useCallback((targetCampus: Campus, nextSelection: RoomSelection) => {
    updatePreferences({
      selections: {
        ...preferencesRef.current.selections,
        [targetCampus]: nextSelection
      }
    })
  }, [updatePreferences])

  const refreshMonitorMeta = useCallback(async () => {
    const state = await loadMonitorRuntimeState()
    if (mountedRef.current) {
      setLastCheckedAt(state.lastCheckedAt)
    }
  }, [])

  const checkForUpdate = useCallback(async () => {
    try {
      const latest = await getMobileUpdate()
      const installed = getInstalledAppVersion()
      if (!mountedRef.current) return

      if (
        latest
        && isUpdateAvailable(installed, latest)
        && (latest.forceUpdate || dismissedUpdateVersionRef.current !== latest.version)
      ) {
        setAvailableUpdate(latest)
        return
      }
      if (!latest || !isUpdateAvailable(installed, latest)) setAvailableUpdate(null)
    } catch {
      // Update checks are best-effort
    }
  }, [])

  const syncMobileDevice = useCallback(async (knownPushToken?: string | null): Promise<string | null> => {
    const token = mobileTokenRef.current || await getMobileInstallationToken()
    mobileTokenRef.current = token
    const installed = getInstalledAppVersion()
    const pushToken = knownPushToken === undefined ? await getRemotePushToken() : knownPushToken
    await registerMobileDevice(
      token,
      installed.version,
      installed.versionCode,
      pushToken || undefined
    )
    return pushToken
  }, [])

  const syncServerWatch = useCallback(async (
    roomToWatch: QueryPayload,
    nextPreferences: StoredPreferences,
    pushToken?: string
  ): Promise<MobileHistoryResponse> => {
    const token = mobileTokenRef.current || await getMobileInstallationToken()
    mobileTokenRef.current = token
    await registerMobileWatch(
      token,
      roomToWatch,
      nextPreferences.threshold,
      nextPreferences.notificationsEnabled,
      pushToken
    )
    return getMobileHistory(token)
  }, [])

  const loadBuildings = useCallback(async (targetCampus: Campus, preferredBuilding = '') => {
    const requestId = buildingRequestIds.current[targetCampus] + 1
    buildingRequestIds.current[targetCampus] = requestId
    setBuildingsLoading(current => ({ ...current, [targetCampus]: true }))
    setBuildingsErrors(current => ({ ...current, [targetCampus]: null }))

    try {
      const response = await getBuildings(targetCampus)
      if (!mountedRef.current || buildingRequestIds.current[targetCampus] !== requestId) return

      setBuildingsByCampus(current => ({ ...current, [targetCampus]: response.buildings }))
      const restoredBuilding = response.buildings.some(item => item.value === preferredBuilding)
        ? preferredBuilding
        : response.buildings[0]?.value || ''

      setBuildingsLoading(current => ({ ...current, [targetCampus]: false }))
      if (campusRef.current === targetCampus) {
        setSelectedBuilding(restoredBuilding)
        if (restoredBuilding !== preferredBuilding) {
          updateSelection(targetCampus, {
            building: restoredBuilding,
            room: selectionFor(preferencesRef.current, targetCampus).room
          })
        }
      }
    } catch (error) {
      if (!mountedRef.current || buildingRequestIds.current[targetCampus] !== requestId) return
      setBuildingsLoading(current => ({ ...current, [targetCampus]: false }))
      setBuildingsErrors(current => ({
        ...current,
        [targetCampus]: errorMessage(error, '楼栋加载失败，请稍后重试')
      }))
    }
  }, [updateSelection])

  useEffect(() => {
    let active = true

    async function restore() {
      void checkForUpdate()
      void syncMobileDevice().catch(() => undefined)
      await refreshMonitorMeta()

      const stored = await loadPreferences()
      if (!active || !mountedRef.current) return

      const restoredCampus = stored.myRoom?.campus || stored.lastCampus
      const restoredSelection = stored.myRoom
        ? { building: stored.myRoom.building, room: stored.myRoom.room }
        : selectionFor(stored, restoredCampus)
      const restoredHistory = await loadHistory(stored.myRoom)
      if (!active || !mountedRef.current) return

      preferencesRef.current = stored
      setPreferences(stored)
      setHistory(restoredHistory)
      setCampus(restoredCampus)
      campusRef.current = restoredCampus
      setSelectedBuilding(restoredSelection.building)
      setRoom(restoredSelection.room)
      await loadBuildings(restoredCampus, restoredSelection.building)

      if (active && mountedRef.current) setHydrating(false)

      if (stored.myRoom) {
        let serverHistoryPoints: HistoryPoint[] = []
        let remoteStats: ServerHistoryStats | null = null
        try {
          const pushToken = stored.notificationsEnabled ? await getRemotePushToken() : null
          const remoteData = await syncServerWatch(stored.myRoom, stored, pushToken || undefined)
          serverHistoryPoints = asHistoryPoints(remoteData.items)
          remoteStats = remoteData.stats
          if (active && mountedRef.current) setServerStats(remoteStats)
        } catch {
          if (stored.monitoringEnabled && active && mountedRef.current) {
            setMonitorError('服务器监控暂时未连接，将在下次打开应用时重试')
          }
        }

        try {
          const initialResult = await queryPower(stored.myRoom)
          if (!active || !mountedRef.current) return
          setResult(initialResult)
          const localHistory = await appendHistory(stored.myRoom, initialResult.kwh, initialResult.updatedAt)
          const merged = mergeHistory(serverHistoryPoints, localHistory)
          setHistory(merged)
        } catch {
          if (active && mountedRef.current) {
            setHistory(mergeHistory(serverHistoryPoints, restoredHistory))
          }
        }
      }

      try {
        await syncHourlyMonitor(Boolean(stored.myRoom && stored.monitoringEnabled))
        if (stored.myRoom && stored.monitoringEnabled) {
          await runMonitorNow().catch(() => undefined)
          await refreshMonitorMeta()
        }
      } catch (error) {
        if (active && mountedRef.current) {
          setMonitorError(stored.myRoom ? '本地后台任务不可用，服务器仍会继续记录' : errorMessage(error, '后台监控不可用'))
        }
      }
    }

    void restore()
    return () => {
      active = false
      mountedRef.current = false
    }
  }, [checkForUpdate, loadBuildings, refreshMonitorMeta, syncMobileDevice, syncServerWatch])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState !== 'active') return
      void checkForUpdate()
      void syncMobileDevice().catch(() => undefined)
      void refreshMonitorMeta()
    })
    return () => subscription.remove()
  }, [checkForUpdate, refreshMonitorMeta, syncMobileDevice])

  const currentBuildings = buildingsByCampus[campus]
  const currentBuildingsLoading = hydrating || buildingsLoading[campus]
  const currentBuildingsError = buildingsErrors[campus]
  const building = currentBuildings.find(item => item.value === selectedBuilding)
  const selectedRoom = roomPayload(campus, selectedBuilding, normalizeRoomInput(room))
  const isMine = Boolean(selectedRoom && sameRoom(preferences.myRoom, selectedRoom))

  // 计算全维度用电统计与图表数据
  const activeHistoryPoints = useMemo(() => {
    if (isMine) return history
    if (result) {
      return [
        {
          kwh: result.kwh,
          createdAt: result.updatedAt || new Date().toISOString(),
          recharged: false
        }
      ]
    }
    return []
  }, [history, isMine, result])

  const effectiveHistoryPoints = useMemo(() => {
    if (demoPreviewEnabled) {
      return buildDemoPowerHistory(result?.kwh ?? 27.8)
    }
    return activeHistoryPoints
  }, [activeHistoryPoints, demoPreviewEnabled, result?.kwh])

  const realAnalytics = useMemo(
    () => analyzePowerHistory(activeHistoryPoints, isMine ? serverStats : null, preferences.threshold),
    [activeHistoryPoints, isMine, preferences.threshold, serverStats]
  )

  const analytics = useMemo(
    () =>
      demoPreviewEnabled
        ? analyzePowerHistory(effectiveHistoryPoints, null, preferences.threshold)
        : realAnalytics,
    [demoPreviewEnabled, effectiveHistoryPoints, preferences.threshold, realAnalytics]
  )

  // 当数据或偏好更新时，同步常驻通知栏卡片与系统级预测闹钟（始终基于真实实测数据）
  useEffect(() => {
    if (!isMine || !preferences.myRoom || !result) return
    void updateOngoingPowerNotification({
      enabled: preferences.monitoringEnabled && preferences.ongoingNotificationEnabled,
      displayName: result.displayName,
      kwh: result.kwh,
      threshold: preferences.threshold,
      estimatedDays: realAnalytics.summary.estimatedDays,
      dailyAverage: realAnalytics.summary.dailyAverage,
      updatedAt: result.updatedAt
    }).catch(() => undefined)

    void syncPredictiveLowPowerAlarm({
      enabled: preferences.monitoringEnabled && preferences.notificationsEnabled,
      displayName: result.displayName,
      currentKwh: result.kwh,
      threshold: preferences.threshold,
      dailyAverage: realAnalytics.summary.dailyAverage
    }).catch(() => undefined)
  }, [
    realAnalytics.summary.dailyAverage,
    realAnalytics.summary.estimatedDays,
    isMine,
    preferences.monitoringEnabled,
    preferences.myRoom,
    preferences.notificationsEnabled,
    preferences.ongoingNotificationEnabled,
    preferences.threshold,
    result
  ])

  const handleCampusChange = useCallback((nextCampus: Campus) => {
    if (nextCampus === campusRef.current || queryLoading) return
    hapticTick()

    const nextSelection = selectionFor(preferencesRef.current, nextCampus)
    updatePreferences({ lastCampus: nextCampus })
    campusRef.current = nextCampus
    setCampus(nextCampus)
    setSelectedBuilding(nextSelection.building)
    setRoom(nextSelection.room)
    setQueryError(null)
    setPickerVisible(false)
    void loadBuildings(nextCampus, nextSelection.building)
  }, [loadBuildings, queryLoading, updatePreferences])

  const handleBuildingSelect = useCallback((nextBuilding: BuildingOption) => {
    hapticTick()
    setSelectedBuilding(nextBuilding.value)
    setQueryError(null)
    setPickerVisible(false)
    updateSelection(campusRef.current, {
      building: nextBuilding.value,
      room
    })
  }, [room, updateSelection])

  const handleRoomChange = useCallback((value: string) => {
    const nextRoom = normalizeRoomInput(value)
    setRoom(nextRoom)
    setQueryError(null)
    updateSelection(campusRef.current, {
      building: selectedBuilding,
      room: nextRoom
    })
  }, [selectedBuilding, updateSelection])

  const runQuery = useCallback(async (fromRefresh = false) => {
    const normalizedRoom = normalizeRoomInput(room)
    if (!selectedBuilding) {
      setQueryError('请先选择楼栋')
      return
    }
    if (!isValidRoom(normalizedRoom)) {
      setQueryError('请输入 2–8 位寝室号，且至少包含一个数字')
      return
    }

    const payload: QueryPayload = {
      campus,
      building: selectedBuilding,
      room: normalizedRoom
    }
    setRoom(normalizedRoom)
    updateSelection(campus, { building: selectedBuilding, room: normalizedRoom })
    if (fromRefresh) setRefreshing(true)
    else setQueryLoading(true)
    setQueryError(null)

    try {
      const data = await queryPower(payload)
      if (!mountedRef.current) return
      setResult(data)
      setRoomSheetVisible(false)

      if (sameRoom(preferencesRef.current.myRoom, payload)) {
        try {
          const localHistory = await appendHistory(payload, data.kwh, data.updatedAt)
          const token = mobileTokenRef.current || await getMobileInstallationToken()
          mobileTokenRef.current = token
          const remoteData = await getMobileHistory(token).catch(() => null)
          if (remoteData && mountedRef.current) {
            setServerStats(remoteData.stats)
            setHistory(mergeHistory(asHistoryPoints(remoteData.items), localHistory))
          } else if (mountedRef.current) {
            setHistory(current => mergeHistory(current, localHistory))
          }
          if (preferencesRef.current.monitoringEnabled) {
            await runMonitorNow().catch(() => undefined)
            await refreshMonitorMeta()
          }
        } catch {
          setMonitorError('趋势数据保存失败')
        }
      }
    } catch (error) {
      if (mountedRef.current) setQueryError(errorMessage(error, '查询失败，请稍后重试'))
    } finally {
      if (mountedRef.current) {
        setQueryLoading(false)
        setRefreshing(false)
      }
    }
  }, [campus, refreshMonitorMeta, room, selectedBuilding, updateSelection])

  const handleSetMine = useCallback(async () => {
    if (!result) return
    const target: QueryPayload = {
      campus: result.campus,
      building: result.building,
      room: result.room
    }
    toggleSeqRef.current += 1
    setMonitorBusy(true)
    setMonitorError(null)
    setMonitorFeedback(null)
    try {
      const current = preferencesRef.current
      if (current.myRoom && !sameRoom(current.myRoom, target) && current.monitoringEnabled) {
        await syncHourlyMonitor(false).catch(() => undefined)
      }
      const same = sameRoom(current.myRoom, target)
      const nextPreferences = updatePreferences({
        myRoom: target,
        monitoringEnabled: same ? current.monitoringEnabled : false,
        notificationsEnabled: same ? current.notificationsEnabled : false
      })
      const localHistory = await appendHistory(target, result.kwh, result.updatedAt)
      setHistory(localHistory)
      // 服务器同步（含推送 Token）放到后台，不阻塞界面
      void (async () => {
        try {
          const pushToken = nextPreferences.notificationsEnabled ? await getRemotePushToken() : undefined
          const remoteData = await syncServerWatch(target, nextPreferences, pushToken || undefined)
          if (mountedRef.current && sameRoom(preferencesRef.current.myRoom, target)) {
            setServerStats(remoteData.stats)
            setHistory(currentHistory => mergeHistory(currentHistory, asHistoryPoints(remoteData.items)))
          }
        } catch {
          if (mountedRef.current) setMonitorError('同步失败，稍后重试')
        }
      })()
    } catch (error) {
      if (mountedRef.current) setMonitorError(errorMessage(error, '我的寝室保存失败'))
    } finally {
      if (mountedRef.current) setMonitorBusy(false)
    }
  }, [result, syncServerWatch, updatePreferences])

  const handleRemoveMine = useCallback(async () => {
    if (!preferencesRef.current.myRoom) return
    toggleSeqRef.current += 1
    setMonitorBusy(true)
    setMonitorError(null)
    setMonitorFeedback(null)
    try {
      await syncHourlyMonitor(false).catch(() => undefined)
      await resetMonitorAlertLock()
      const token = mobileTokenRef.current || await getMobileInstallationToken()
      mobileTokenRef.current = token
      await removeMobileWatch(token).catch(() => undefined)
      await clearHistory()
      updatePreferences({
        myRoom: null,
        monitoringEnabled: false,
        notificationsEnabled: false
      })
      setHistory([])
      setServerStats(null)
    } catch (error) {
      if (mountedRef.current) setMonitorError(errorMessage(error, '取消我的寝室失败'))
    } finally {
      if (mountedRef.current) setMonitorBusy(false)
    }
  }, [updatePreferences])

  const handleThresholdChange = useCallback((value: number) => {
    const safeThreshold = normalizeThreshold(value, preferencesRef.current.threshold)
    const nextPreferences = updatePreferences({
      threshold: safeThreshold
    })
    setMonitorFeedback(null)
    if (!nextPreferences.myRoom) return
    const roomToUpdate = nextPreferences.myRoom
    const seq = ++thresholdSeqRef.current

    void (async () => {
      try {
        await resetMonitorAlertLock()
        const pushToken = nextPreferences.notificationsEnabled ? await getRemotePushToken() : undefined
        // 连续点击步进器时，只让最后一次同步生效
        if (thresholdSeqRef.current !== seq || !mountedRef.current) return
        await syncServerWatch(roomToUpdate, nextPreferences, pushToken || undefined)
        if (thresholdSeqRef.current !== seq) return
        if (nextPreferences.monitoringEnabled) {
          await runMonitorNow().catch(() => undefined)
          await refreshMonitorMeta()
        }
      } catch {
        if (mountedRef.current) setMonitorError('阈值同步失败')
      }
    })()
  }, [refreshMonitorMeta, syncServerWatch, updatePreferences])

  const handleToggleMonitoring = useCallback(async () => {
    const roomToMonitor = preferencesRef.current.myRoom
    if (!roomToMonitor) return

    const wasEnabled = preferencesRef.current.monitoringEnabled
    const seq = ++toggleSeqRef.current
    const isCurrent = () => mountedRef.current && toggleSeqRef.current === seq
    setMonitorError(null)
    setMonitorFeedback(null)

    if (wasEnabled) {
      // 关闭：开关立即响应，网络与后台任务清理在后台完成
      const nextPreferences = updatePreferences({ monitoringEnabled: false, notificationsEnabled: false })
      toggleChainRef.current = toggleChainRef.current.then(async () => {
        await syncHourlyMonitor(false).catch(() => undefined)
        await syncServerWatch(roomToMonitor, nextPreferences).catch(() => undefined)
      })
      return
    }

    // 开启：只有系统权限弹窗需要等待，其余全部异步进行
    setMonitorBusy(true)
    let granted = false
    try {
      granted = await requestNotificationAccess()
    } catch {
      granted = false
    }
    if (mountedRef.current) setMonitorBusy(false)
    if (!isCurrent()) return
    if (!granted) {
      setMonitorError('未获得通知权限')
      return
    }

    const nextPreferences = updatePreferences({ monitoringEnabled: true, notificationsEnabled: true })

    toggleChainRef.current = toggleChainRef.current.then(async () => {
      await resetMonitorAlertLock().catch(() => undefined)
      await persistenceQueue.current
      if (!isCurrent()) return

      let localReady = true
      await syncHourlyMonitor(true).catch(() => {
        localReady = false
      })
      if (!isCurrent()) {
        // 用户在注册过程中又关掉了开关
        if (!preferencesRef.current.monitoringEnabled) await syncHourlyMonitor(false).catch(() => undefined)
        return
      }

      const pushToken = await getRemotePushToken()
      void syncMobileDevice(pushToken).catch(() => undefined)
      const remoteData = await syncServerWatch(roomToMonitor, nextPreferences, pushToken || undefined).catch(() => null)
      if (!isCurrent()) return

      const localHistory = await runMonitorNow().catch((): HistoryPoint[] => [])
      await refreshMonitorMeta()
      if (!isCurrent() || !sameRoom(preferencesRef.current.myRoom, roomToMonitor)) return

      if (remoteData) {
        setServerStats(remoteData.stats)
        setHistory(current => mergeHistory(current, asHistoryPoints(remoteData.items), localHistory))
      } else if (localHistory.length > 0) {
        setHistory(current => mergeHistory(current, localHistory))
      }

      if (!remoteData && !localReady) setMonitorError('后台提醒暂不可用')
    }).catch(() => undefined)
  }, [refreshMonitorMeta, syncMobileDevice, syncServerWatch, updatePreferences])

  const handleToggleOngoing = useCallback(() => {
    const nextVal = !preferencesRef.current.ongoingNotificationEnabled
    updatePreferences({ ongoingNotificationEnabled: nextVal })
  }, [updatePreferences])

  const handleTestNotification = useCallback(async () => {
    setTestingNotification(true)
    setMonitorError(null)
    setMonitorFeedback(null)
    try {
      await sendTestNotification(
        result?.displayName,
        result?.kwh ?? analytics.summary.current,
        preferencesRef.current.threshold
      )
    } catch (error) {
      if (mountedRef.current) {
        setMonitorError(errorMessage(error, '测试通知发送失败'))
      }
    } finally {
      if (mountedRef.current) setTestingNotification(false)
    }
  }, [analytics.summary.current, result])

  const handleUpdateInstall = useCallback(async () => {
    if (!availableUpdate) return
    setUpdateBusy(true)
    setUpdateError(null)
    try {
      await Linking.openURL(availableUpdate.downloadUrl)
    } catch {
      if (mountedRef.current) setUpdateError('无法打开下载地址，请稍后再试')
    } finally {
      if (mountedRef.current) setUpdateBusy(false)
    }
  }, [availableUpdate])

  const handleUpdateDismiss = useCallback(() => {
    if (!availableUpdate) return
    dismissedUpdateVersionRef.current = availableUpdate.version
    setAvailableUpdate(null)
    setUpdateError(null)
  }, [availableUpdate])

  const hasActiveDashboard = Boolean(result || isMine)
  const roomPillLabel = useMemo(() => {
    if (result?.displayName) return result.displayName.replace(/\s*·\s*/g, ' ')
    if (building && room) return `${campus} ${building.label} ${room}`
    return '选择寝室'
  }, [building, campus, result, room])

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          hasActiveDashboard ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                hapticLight()
                void runQuery(true)
              }}
              tintColor={colors.iosBlue}
              colors={[colors.iosBlue]}
            />
          ) : undefined
        }
      >
        <View style={styles.page}>
          {/* Apple HIG 极简大标题顶栏 */}
          <View style={styles.navBar}>
            <Text style={styles.navTitle}>宿舍电量</Text>

            {hasActiveDashboard ? (
              <Pressable
                onPress={() => {
                  hapticLight()
                  setRoomSheetVisible(true)
                }}
                style={({ pressed }) => [styles.roomPill, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`当前寝室 ${roomPillLabel}，点击切换`}
              >
                <Text style={styles.roomPillText} numberOfLines={1}>
                  {roomPillLabel}
                </Text>
                <Text style={styles.roomPillChevron}>▾</Text>
              </Pressable>
            ) : null}
          </View>

          {availableUpdate ? (
            <UpdateCard
              update={availableUpdate}
              busy={updateBusy}
              error={updateError}
              onInstall={() => void handleUpdateInstall()}
              onDismiss={handleUpdateDismiss}
            />
          ) : null}

          {hydrating ? (
            <View style={styles.bootstrapState}>
              <ActivityIndicator color={colors.iosBlue} />
              <Text style={styles.bootstrapText}>同步中…</Text>
            </View>
          ) : null}

          {!hydrating && !hasActiveDashboard ? (
            <QueryCard
              campus={campus}
              building={building}
              room={room}
              buildingsLoading={currentBuildingsLoading}
              buildingsError={currentBuildingsError}
              queryLoading={queryLoading}
              disabled={hydrating || queryLoading}
              onCampusChange={handleCampusChange}
              onOpenBuildingPicker={() => {
                hapticLight()
                setPickerVisible(true)
              }}
              onRetryBuildings={() => void loadBuildings(campus, selectedBuilding)}
              onRoomChange={handleRoomChange}
              onQuery={() => {
                hapticLight()
                void runQuery(false)
              }}
            />
          ) : null}

          {!hydrating && currentBuildingsError && !hasActiveDashboard ? (
            <StateCard
              kind="error"
              title="楼栋加载失败"
              message={currentBuildingsError}
              onRetry={() => void loadBuildings(campus, selectedBuilding)}
            />
          ) : null}

          {queryLoading && !refreshing ? (
            <StateCard kind="loading" title="查询中" message="" />
          ) : queryError ? (
            <StateCard
              kind="error"
              title="查询失败"
              message={queryError}
              onRetry={() => void runQuery(false)}
            />
          ) : null}

          {!hydrating && hasActiveDashboard ? (
            <>
              <HeroTelemetryCard
                result={result}
                summary={analytics.summary}
                threshold={preferences.threshold}
                isMine={isMine}
                busy={monitorBusy}
                refreshing={refreshing || queryLoading}
                onRefresh={() => {
                  hapticLight()
                  void runQuery(true)
                }}
                onSetMine={() => {
                  hapticSuccess()
                  void handleSetMine()
                }}
                onRemoveMine={() => {
                  hapticLight()
                  void handleRemoveMine()
                }}
              />

              <EnergyAnalyticsCard
                points={effectiveHistoryPoints}
                hourlyDays={analytics.hourlyDays}
                dailyBars={analytics.dailyBars}
                forecastPoints={analytics.forecastPoints}
                dailyAverage={analytics.summary.dailyAverage}
                threshold={preferences.threshold}
                showDemoToggle={isMine && (realAnalytics.summary.dailyAverage === null || demoPreviewEnabled)}
                demoActive={demoPreviewEnabled}
                onToggleDemo={() => setDemoPreviewEnabled(prev => !prev)}
              />

              <PatternInsightsCard
                periods={analytics.periods}
                heatmap={analytics.heatmap}
                rechargeCount={analytics.summary.rechargeCount}
                lastRechargeAmount={analytics.summary.lastRechargeAmount}
              />

              {isMine ? (
                <MonitorCard
                  threshold={Math.max(MIN_THRESHOLD, Math.min(MAX_THRESHOLD, preferences.threshold))}
                  enabled={preferences.monitoringEnabled}
                  ongoingEnabled={preferences.ongoingNotificationEnabled}
                  thresholdEtaLabel={analytics.summary.thresholdEtaLabel}
                  lastCheckedAt={lastCheckedAt}
                  busy={monitorBusy}
                  testingNotification={testingNotification}
                  feedbackMessage={monitorFeedback}
                  error={monitorError}
                  onThresholdChange={val => {
                    hapticTick()
                    handleThresholdChange(val)
                  }}
                  onToggle={() => {
                    hapticLight()
                    void handleToggleMonitoring()
                  }}
                  onToggleOngoing={() => {
                    hapticLight()
                    handleToggleOngoing()
                  }}
                  onTestNotification={() => {
                    hapticSuccess()
                    void handleTestNotification()
                  }}
                  onOpenBatterySettings={() => {
                    hapticLight()
                    void openBatteryOptimizationSettings()
                  }}
                />
              ) : null}
            </>
          ) : null}
        </View>
      </ScrollView>

      {/* 顶部寝室胶囊触发的切换/查询抽屉 */}
      <RoomSwitcherModal
        visible={roomSheetVisible}
        campus={campus}
        building={building}
        room={room}
        buildingsLoading={currentBuildingsLoading}
        buildingsError={currentBuildingsError}
        queryLoading={queryLoading}
        disabled={hydrating || queryLoading}
        onClose={() => setRoomSheetVisible(false)}
        onCampusChange={handleCampusChange}
        onOpenBuildingPicker={() => setPickerVisible(true)}
        onRetryBuildings={() => void loadBuildings(campus, selectedBuilding)}
        onRoomChange={handleRoomChange}
        onQuery={() => void runQuery(false)}
      />

      <BuildingPickerModal
        visible={pickerVisible}
        campus={campus}
        buildings={currentBuildings}
        selectedValue={selectedBuilding}
        loading={buildingsLoading[campus]}
        error={currentBuildingsError}
        onClose={() => setPickerVisible(false)}
        onSelect={handleBuildingSelect}
        onRetry={() => void loadBuildings(campus, selectedBuilding)}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
  scrollContent: {
    flexGrow: 1
  },
  page: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: 38
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 44,
    paddingBottom: 16,
    paddingHorizontal: 2,
    gap: spacing.sm
  },
  navTitle: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.9
  },
  navSubtitle: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 12
  },
  roomPill: {
    maxWidth: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.controlMuted
  },
  roomPillText: {
    flexShrink: 1,
    color: colors.text,
    fontSize: 12,
    fontWeight: '600'
  },
  roomPillChevron: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700'
  },
  bootstrapState: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    paddingVertical: 18,
    borderRadius: radii.card,
    backgroundColor: colors.surface
  },
  bootstrapText: {
    marginLeft: 10,
    color: colors.textSecondary,
    fontSize: 13
  },
  bindBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.card,
    backgroundColor: colors.iosBlueSurface
  },
  bindBannerTextWrap: {
    flex: 1
  },
  bindBannerTitle: {
    color: colors.iosBlue,
    fontSize: 14,
    fontWeight: '700'
  },
  bindBannerDesc: {
    marginTop: 2,
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 16
  },
  bindBannerBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.iosBlue
  },
  bindBannerBtnText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: '600'
  },
  demoBannerActive: {
    backgroundColor: colors.iosAmberSurface
  },
  demoBannerTitleActive: {
    color: colors.iosAmberDark
  },
  demoBannerBtnActive: {
    backgroundColor: colors.iosAmberDark
  },
  pressed: {
    opacity: 0.68
  }
})
