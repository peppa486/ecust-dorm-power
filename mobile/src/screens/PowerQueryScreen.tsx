import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native'

import { ApiError, getBuildings, queryPower } from '../api/client'
import { BuildingPickerModal } from '../components/BuildingPickerModal'
import { MonitorCard } from '../components/MonitorCard'
import { QueryCard } from '../components/QueryCard'
import { ResultCard } from '../components/ResultCard'
import { StateCard } from '../components/StateCard'
import { TrendChart } from '../components/TrendChart'
import { requestNotificationAccess, runMonitorNow, syncHourlyMonitor } from '../monitoring/background'
import { appendHistory, clearHistory, loadHistory, type HistoryPoint } from '../storage/history'
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
import { CAMPUSES, type BuildingOption, type Campus, type PowerResult, type QueryPayload } from '../types/api'
import { colors, radii, spacing } from '../theme'
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
  const [queryError, setQueryError] = useState<string | null>(null)
  const [result, setResult] = useState<PowerResult | null>(null)
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [monitorError, setMonitorError] = useState<string | null>(null)
  const [monitorBusy, setMonitorBusy] = useState(false)
  const [pickerVisible, setPickerVisible] = useState(false)

  const mountedRef = useRef(true)
  const campusRef = useRef<Campus>(CAMPUSES[0])
  const preferencesRef = useRef(preferences)
  const buildingRequestIds = useRef<CampusMap<number>>({ 奉贤: 0, 徐汇: 0 })
  const persistenceQueue = useRef<Promise<void>>(Promise.resolve())

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
      const stored = await loadPreferences()
      if (!active || !mountedRef.current) return

      const restoredCampus = stored.lastCampus
      const restoredSelection = selectionFor(stored, restoredCampus)
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
        try {
          const initialResult = await queryPower(stored.myRoom)
          if (!active || !mountedRef.current) return
          setResult(initialResult)
          setHistory(await appendHistory(stored.myRoom, initialResult.kwh, initialResult.updatedAt))
        } catch {
          // 保留本地趋势，首页仍可继续手动查询。
        }
      }

      try {
        await syncHourlyMonitor(Boolean(stored.myRoom && stored.monitoringEnabled))
      } catch (error) {
        if (active && mountedRef.current) setMonitorError(errorMessage(error, '后台监控不可用'))
      }
    }

    void restore()
    return () => {
      active = false
      mountedRef.current = false
    }
  }, [loadBuildings])

  const currentBuildings = buildingsByCampus[campus]
  const currentBuildingsLoading = hydrating || buildingsLoading[campus]
  const currentBuildingsError = buildingsErrors[campus]
  const building = currentBuildings.find(item => item.value === selectedBuilding)
  const selectedRoom = roomPayload(campus, selectedBuilding, normalizeRoomInput(room))
  const isMine = Boolean(selectedRoom && sameRoom(preferences.myRoom, selectedRoom))

  const handleCampusChange = useCallback((nextCampus: Campus) => {
    if (nextCampus === campusRef.current || queryLoading) return

    const nextSelection = selectionFor(preferencesRef.current, nextCampus)
    updatePreferences({ lastCampus: nextCampus })
    campusRef.current = nextCampus
    setCampus(nextCampus)
    setSelectedBuilding(nextSelection.building)
    setRoom(nextSelection.room)
    setResult(null)
    setQueryError(null)
    setPickerVisible(false)
    void loadBuildings(nextCampus, nextSelection.building)
  }, [loadBuildings, queryLoading, updatePreferences])

  const handleBuildingSelect = useCallback((nextBuilding: BuildingOption) => {
    setSelectedBuilding(nextBuilding.value)
    setResult(null)
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
    setResult(null)
    setQueryError(null)
    updateSelection(campusRef.current, {
      building: selectedBuilding,
      room: nextRoom
    })
  }, [selectedBuilding, updateSelection])

  const runQuery = useCallback(async () => {
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
    setQueryLoading(true)
    setQueryError(null)
    setResult(null)

    try {
      const data = await queryPower(payload)
      if (!mountedRef.current) return
      setResult(data)
      if (sameRoom(preferencesRef.current.myRoom, payload)) {
        try {
          setHistory(await appendHistory(payload, data.kwh, data.updatedAt))
        } catch {
          setMonitorError('趋势数据保存失败')
        }
      }
    } catch (error) {
      if (mountedRef.current) setQueryError(errorMessage(error, '查询失败，请稍后重试'))
    } finally {
      if (mountedRef.current) setQueryLoading(false)
    }
  }, [campus, room, selectedBuilding, updateSelection])

  const handleSetMine = useCallback(async () => {
    if (!result) return
    const target: QueryPayload = {
      campus: result.campus,
      building: result.building,
      room: result.room
    }
    setMonitorBusy(true)
    setMonitorError(null)
    try {
      const current = preferencesRef.current
      if (current.myRoom && !sameRoom(current.myRoom, target) && current.monitoringEnabled) {
        await syncHourlyMonitor(false).catch(() => undefined)
      }
      const same = sameRoom(current.myRoom, target)
      updatePreferences({
        myRoom: target,
        monitoringEnabled: same ? current.monitoringEnabled : false,
        notificationsEnabled: same ? current.notificationsEnabled : false
      })
      setHistory(await appendHistory(target, result.kwh, result.updatedAt))
    } catch (error) {
      if (mountedRef.current) setMonitorError(errorMessage(error, '我的寝室保存失败'))
    } finally {
      if (mountedRef.current) setMonitorBusy(false)
    }
  }, [result, updatePreferences])

  const handleRemoveMine = useCallback(async () => {
    if (!preferencesRef.current.myRoom) return
    setMonitorBusy(true)
    setMonitorError(null)
    try {
      await syncHourlyMonitor(false)
      await clearHistory()
      updatePreferences({
        myRoom: null,
        monitoringEnabled: false,
        notificationsEnabled: false
      })
      setHistory([])
    } catch (error) {
      if (mountedRef.current) setMonitorError(errorMessage(error, '取消我的寝室失败'))
    } finally {
      if (mountedRef.current) setMonitorBusy(false)
    }
  }, [updatePreferences])

  const handleThresholdChange = useCallback((value: number) => {
    updatePreferences({ threshold: normalizeThreshold(value, preferencesRef.current.threshold) })
  }, [updatePreferences])

  const handleToggleMonitoring = useCallback(async () => {
    const roomToMonitor = preferencesRef.current.myRoom
    if (!roomToMonitor) return

    const wasEnabled = preferencesRef.current.monitoringEnabled
    setMonitorBusy(true)
    setMonitorError(null)
    try {
      if (wasEnabled) {
        await syncHourlyMonitor(false)
        updatePreferences({ monitoringEnabled: false })
      } else {
        const granted = await requestNotificationAccess()
        if (!granted) throw new Error('请允许通知权限后再开启提醒')

        updatePreferences({ monitoringEnabled: true, notificationsEnabled: true })
        await persistenceQueue.current
        await syncHourlyMonitor(true)
        const nextHistory = await runMonitorNow()
        if (mountedRef.current && sameRoom(preferencesRef.current.myRoom, roomToMonitor)) {
          setHistory(nextHistory)
        }
      }
    } catch (error) {
      if (!wasEnabled) {
        await syncHourlyMonitor(false).catch(() => undefined)
        updatePreferences({ monitoringEnabled: false, notificationsEnabled: false })
      }
      if (mountedRef.current) setMonitorError(errorMessage(error, '提醒开启失败'))
    } finally {
      if (mountedRef.current) setMonitorBusy(false)
    }
  }, [updatePreferences])

  const showBuildingEmpty = !hydrating && !currentBuildingsLoading && !currentBuildingsError && currentBuildings.length === 0

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.page}>
          <View style={styles.hero}>
            <Text style={styles.title}>华理宿舍电量查询</Text>
          </View>

          <QueryCard
            campus={campus}
            building={building}
            room={room}
            buildingsLoading={currentBuildingsLoading}
            buildingsError={currentBuildingsError}
            queryLoading={queryLoading}
            disabled={hydrating || queryLoading}
            onCampusChange={handleCampusChange}
            onOpenBuildingPicker={() => setPickerVisible(true)}
            onRetryBuildings={() => void loadBuildings(campus, selectedBuilding)}
            onRoomChange={handleRoomChange}
            onQuery={() => void runQuery()}
          />

          {hydrating ? (
            <View style={styles.bootstrapState}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.bootstrapText}>正在恢复上次选择…</Text>
            </View>
          ) : null}

          {!hydrating && currentBuildingsError ? (
            <StateCard
              kind="error"
              title="楼栋加载失败"
              message={currentBuildingsError}
              onRetry={() => void loadBuildings(campus, selectedBuilding)}
            />
          ) : null}

          {showBuildingEmpty ? (
            <StateCard
              kind="empty"
              title="暂无可选楼栋"
              message="当前校区暂时没有可用的楼栋数据，请稍后再试。"
              onRetry={() => void loadBuildings(campus, selectedBuilding)}
            />
          ) : null}

          {queryLoading ? (
            <StateCard kind="loading" title="正在查询" message="正在获取最新电量，请稍候。" />
          ) : queryError ? (
            <StateCard kind="error" title="查询失败" message={queryError} onRetry={() => void runQuery()} />
          ) : result ? (
            <ResultCard
              result={result}
              isMine={isMine}
              busy={monitorBusy}
              onSetMine={() => void handleSetMine()}
              onRemoveMine={() => void handleRemoveMine()}
            />
          ) : !hydrating && !currentBuildingsLoading && !currentBuildingsError && currentBuildings.length > 0 && !isMine ? (
            <StateCard kind="empty" title="还没有查询记录" message="选择楼栋并输入寝室号，查询当前剩余电量。" />
          ) : null}

          {!hydrating && isMine ? (
            <>
              <MonitorCard
                threshold={Math.max(MIN_THRESHOLD, Math.min(MAX_THRESHOLD, preferences.threshold))}
                enabled={preferences.monitoringEnabled}
                busy={monitorBusy}
                error={monitorError}
                onThresholdChange={handleThresholdChange}
                onToggle={() => void handleToggleMonitoring()}
              />
              <TrendChart points={history} />
            </>
          ) : null}
        </View>
      </ScrollView>

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
    paddingHorizontal: spacing.xl,
    paddingBottom: 34
  },
  hero: {
    paddingTop: 52,
    paddingBottom: 22,
    paddingHorizontal: spacing.xs
  },
  title: {
    color: colors.text,
    fontSize: 29,
    fontWeight: '800',
    letterSpacing: -1.2
  },
  bootstrapState: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    paddingVertical: 17,
    borderRadius: radii.control + 6,
    backgroundColor: colors.surface
  },
  bootstrapText: {
    marginLeft: 10,
    color: colors.textSecondary,
    fontSize: 13
  }
})
