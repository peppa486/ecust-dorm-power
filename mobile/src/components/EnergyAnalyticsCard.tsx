import { useMemo, useRef, useState } from 'react'
import {
  LayoutChangeEvent,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native'

import type { HistoryPoint } from '../storage/history'
import { cardShadow, colors, hairlineWidth, radii, spacing } from '../theme'
import { SegmentedControl, type SegmentOption } from './SegmentedControl'
import type {
  DailyConsumptionPoint,
  ForecastPoint,
  HourlyDayRecord
} from '../utils/analytics'
import { hapticLight, hapticTick } from '../utils/haptics'
import { formatNumberCompact, formatUpdatedAt } from '../utils/power'

type ChartTab = 'hourly' | 'daily' | 'balance'

const TAB_OPTIONS: readonly SegmentOption<ChartTab>[] = [
  { key: 'hourly', label: '按小时' },
  { key: 'daily', label: '按日' },
  { key: 'balance', label: '余量趋势' }
]

interface EnergyAnalyticsCardProps {
  points: HistoryPoint[]
  hourlyDays: HourlyDayRecord[]
  dailyBars: DailyConsumptionPoint[]
  forecastPoints: ForecastPoint[]
  dailyAverage: number | null
  threshold: number
  showDemoToggle?: boolean
  demoActive?: boolean
  onToggleDemo?: () => void
}

const CHART_HEIGHT = 164
const DETAIL_CHART_HEIGHT = 250
const CHART_PADDING = 10
const DETAIL_POINT_WIDTH = 14
const GRID_RATIOS = [0.25, 0.5, 0.75]

interface LineCanvasProps {
  points: HistoryPoint[]
  forecastPoints: ForecastPoint[]
  threshold: number
  width: number
  height: number
  selectedIndex: number | null
  onSelectPoint?: (index: number) => void
  onLayout?: (event: LayoutChangeEvent) => void
  fluid?: boolean
}

function BalanceLineCanvas({
  points,
  forecastPoints,
  threshold,
  width,
  height,
  selectedIndex,
  onSelectPoint,
  onLayout,
  fluid = false
}: LineCanvasProps) {
  const { coordinates, forecastCoords, min, max, thresholdY } = useMemo(() => {
    const allValues = [
      ...points.map(p => p.kwh),
      ...forecastPoints.map(p => p.kwh),
      threshold
    ].filter(v => Number.isFinite(v))

    const rawMin = allValues.length ? Math.min(...allValues) : 0
    const rawMax = allValues.length ? Math.max(...allValues) : 20
    const minVal = Math.max(0, Math.floor(rawMin - 2))
    const maxVal = Math.max(minVal + 5, Math.ceil(rawMax + 2))
    const valRange = Math.max(maxVal - minVal, 1)

    const pointTimes = points.map(p => Date.parse(p.createdAt)).filter(t => Number.isFinite(t))
    const forecastTimes = forecastPoints.map(p => p.timestamp).filter(t => Number.isFinite(t))
    const allTimes = [...pointTimes, ...forecastTimes]
    const tStart = allTimes.length ? Math.min(...allTimes) : 0
    const tEnd = allTimes.length ? Math.max(...allTimes) : 1
    const tRange = Math.max(tEnd - tStart, 1)

    const usableW = Math.max(width - CHART_PADDING * 2, 1)
    const usableH = Math.max(height - CHART_PADDING * 2, 1)

    const toCoord = (kwh: number, timeMs: number, fallbackRatio: number) => {
      const xRatio = allTimes.length > 1 && Number.isFinite(timeMs)
        ? Math.min(1, Math.max(0, (timeMs - tStart) / tRange))
        : fallbackRatio
      const yRatio = 1 - Math.min(1, Math.max(0, (kwh - minVal) / valRange))
      return {
        x: CHART_PADDING + xRatio * usableW,
        y: CHART_PADDING + yRatio * usableH
      }
    }

    const coords = width > 0
      ? points.map((p, idx) => {
        const pos = toCoord(
          p.kwh,
          Date.parse(p.createdAt),
          points.length === 1 ? 0.5 : idx / (points.length - 1)
        )
        return {
          ...pos,
          recharged: p.recharged,
          kwh: p.kwh,
          createdAt: p.createdAt
        }
      })
      : []

    const fCoords = width > 0
      ? forecastPoints.map((fp, idx) => toCoord(
        fp.kwh,
        fp.timestamp,
        forecastPoints.length === 1 ? 1 : idx / (forecastPoints.length - 1)
      ))
      : []

    const threshRatio = 1 - Math.min(1, Math.max(0, (threshold - minVal) / valRange))
    const tY = CHART_PADDING + threshRatio * usableH

    return {
      coordinates: coords,
      forecastCoords: fCoords,
      min: minVal,
      max: maxVal,
      thresholdY: tY
    }
  }, [forecastPoints, height, points, threshold, width])

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.lineCanvas,
        fluid ? styles.lineCanvasFluid : null,
        { height, width: fluid ? undefined : width }
      ]}
    >
      {GRID_RATIOS.map(ratio => (
        <View
          key={`grid-${ratio}`}
          pointerEvents="none"
          style={[
            styles.hGridLine,
            { top: CHART_PADDING + ratio * (height - CHART_PADDING * 2) }
          ]}
        />
      ))}

      {thresholdY >= CHART_PADDING && thresholdY <= height - CHART_PADDING ? (
        <View
          pointerEvents="none"
          style={[styles.thresholdLine, { top: thresholdY }]}
        >
          <Text style={styles.thresholdLineTag}>阈值 {threshold}度</Text>
        </View>
      ) : null}

      {coordinates.slice(1).map((point, index) => {
        const previous = coordinates[index]
        const dx = point.x - previous.x
        const dy = point.y - previous.y
        const length = Math.sqrt(dx * dx + dy * dy)
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI
        return (
          <View
            key={`seg-${index}`}
            pointerEvents="none"
            style={[
              styles.lineSegment,
              point.recharged ? styles.rechargeSegment : null,
              {
                left: previous.x,
                top: previous.y - 1.25,
                width: length,
                transform: [{ rotate: `${angle}deg` }]
              }
            ]}
          />
        )
      })}

      {forecastCoords.slice(1).map((point, index) => {
        const previous = forecastCoords[index]
        const dx = point.x - previous.x
        const dy = point.y - previous.y
        const length = Math.sqrt(dx * dx + dy * dy)
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI
        return (
          <View
            key={`fseg-${index}`}
            pointerEvents="none"
            style={[
              styles.forecastSegment,
              {
                left: previous.x,
                top: previous.y - 1,
                width: length,
                transform: [{ rotate: `${angle}deg` }]
              }
            ]}
          />
        )
      })}

      {coordinates.map((point, index) => {
        const isLast = index === coordinates.length - 1
        const isSelected = selectedIndex === index
        const showDot = point.recharged || isLast || isSelected
        return (
          <Pressable
            key={`pt-${index}`}
            onPress={() => {
              hapticTick()
              onSelectPoint?.(index)
            }}
            hitSlop={8}
            style={[
              styles.pointHitBox,
              {
                left: point.x - 10,
                top: point.y - 10
              }
            ]}
          >
            {showDot ? (
              <View
                style={[
                  styles.pointDot,
                  point.recharged
                    ? styles.rechargeDot
                    : isSelected
                      ? styles.selectedDot
                      : styles.currentDot
                ]}
              />
            ) : null}
          </Pressable>
        )
      })}

      <Text pointerEvents="none" style={[styles.canvasYLabel, { top: 6 }]}>
        {max}度
      </Text>
      <Text pointerEvents="none" style={[styles.canvasYLabel, { bottom: 6 }]}>
        {min}度
      </Text>
    </View>
  )
}

export function EnergyAnalyticsCard({
  points,
  hourlyDays,
  dailyBars,
  forecastPoints,
  dailyAverage,
  threshold,
  showDemoToggle = false,
  demoActive = false,
  onToggleDemo
}: EnergyAnalyticsCardProps) {
  const [activeTab, setActiveTab] = useState<ChartTab>('hourly')
  const [dayOffset, setDayOffset] = useState(0)
  const [selectedHour, setSelectedHour] = useState<number | null>(null)
  const [selectedDailyIndex, setSelectedDailyIndex] = useState<number | null>(null)
  const [selectedBalanceIdx, setSelectedBalanceIdx] = useState<number | null>(null)
  const [lineWidth, setLineWidth] = useState(0)
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const detailScrollRef = useRef<ScrollView>(null)

  const maxDayOffset = Math.max(0, hourlyDays.length - 1)
  const clampedOffset = Math.min(dayOffset, maxDayOffset)
  const activeDayIndex = Math.max(0, hourlyDays.length - 1 - clampedOffset)
  const currentDay: HourlyDayRecord | undefined = hourlyDays[activeDayIndex]

  const hourlyMax = useMemo(() => {
    if (!currentDay) return 1
    const maxVal = Math.max(...currentDay.hours.map(h => h.kwh), 0.4)
    return Math.ceil(maxVal * 10) / 10
  }, [currentDay])

  const recentDailyBars = useMemo(() => dailyBars.slice(-10), [dailyBars])
  const dailyMax = useMemo(() => {
    const values = recentDailyBars.map(d => d.kwh)
    if (dailyAverage) values.push(dailyAverage)
    const maxVal = Math.max(...values, 2)
    return Math.ceil(maxVal)
  }, [dailyAverage, recentDailyBars])

  const previewBalancePoints = useMemo(() => points.slice(-72), [points])
  const detailBalancePoints = useMemo(() => points.slice(-336), [points])

  function handleSwitchTab(tab: ChartTab) {
    if (tab !== activeTab) hapticTick()
    setActiveTab(tab)
  }

  function handleJumpToDayHourly(dateKey: string) {
    const idx = hourlyDays.findIndex(d => d.dateKey === dateKey)
    if (idx >= 0) {
      hapticLight()
      const nextOffset = hourlyDays.length - 1 - idx
      setDayOffset(nextOffset)
      setSelectedHour(null)
      setActiveTab('hourly')
    }
  }

  const selectedHourBucket = currentDay && selectedHour !== null
    ? currentDay.hours[selectedHour]
    : null

  const selectedDailyBar = selectedDailyIndex !== null
    ? recentDailyBars[selectedDailyIndex]
    : null

  const selectedBalancePoint = selectedBalanceIdx !== null
    ? previewBalancePoints[selectedBalanceIdx]
    : previewBalancePoints[previewBalancePoints.length - 1]

  return (
    <View style={styles.card}>
      <SegmentedControl
        options={TAB_OPTIONS}
        value={activeTab}
        onChange={handleSwitchTab}
        style={styles.segmented}
      />

      {/* ==================== 视图 1：24 小时分时用电柱状图 ==================== */}
      {activeTab === 'hourly' && currentDay ? (
        <View>
          <View style={styles.calloutRow}>
            <View style={styles.calloutLeft}>
              <Text style={styles.calloutLabel}>
                {selectedHourBucket
                  ? `${currentDay.shortLabel} ${selectedHourBucket.rangeLabel}`
                  : currentDay.label}
              </Text>
              <View style={styles.calloutValueRow}>
                <Text style={styles.calloutValue}>
                  {formatNumberCompact(
                    selectedHourBucket ? selectedHourBucket.kwh : currentDay.totalKwh,
                    2
                  )}
                </Text>
                <Text style={styles.calloutUnit}>度</Text>
              </View>
            </View>

            <View style={styles.rightControls}>
              {showDemoToggle && onToggleDemo ? (
                <Pressable
                  onPress={() => {
                    hapticLight()
                    onToggleDemo()
                  }}
                  style={[styles.demoChip, demoActive && styles.demoChipActive]}
                >
                  <Text style={[styles.demoChipText, demoActive && styles.demoChipTextActive]}>
                    {demoActive ? '切回实测' : '预览示例'}
                  </Text>
                </Pressable>
              ) : null}

              <View style={styles.dayPager}>
                <Pressable
                  onPress={() => {
                    hapticTick()
                    setDayOffset(prev => Math.min(maxDayOffset, prev + 1))
                    setSelectedHour(null)
                  }}
                  disabled={clampedOffset >= maxDayOffset}
                  style={({ pressed }) => [
                    styles.pagerBtn,
                    pressed && styles.pressed,
                    clampedOffset >= maxDayOffset && styles.disabled
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="前一天"
                >
                  <Text style={styles.pagerBtnText}>‹</Text>
                </Pressable>
                <Text style={styles.pagerDateText}>{currentDay.shortLabel}</Text>
                <Pressable
                  onPress={() => {
                    hapticTick()
                    setDayOffset(prev => Math.max(0, prev - 1))
                    setSelectedHour(null)
                  }}
                  disabled={clampedOffset <= 0}
                  style={({ pressed }) => [
                    styles.pagerBtn,
                    pressed && styles.pressed,
                    clampedOffset <= 0 && styles.disabled
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="后一天"
                >
                  <Text style={styles.pagerBtnText}>›</Text>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.hourlyChartWrap}>
            <View style={styles.hourlyBarsArea}>
              <View style={[styles.hGridLine, { top: '25%' }]} pointerEvents="none" />
              <View style={[styles.hGridLine, { top: '62%' }]} pointerEvents="none" />

              <View style={[styles.vGridLine, { left: '0%' }]} pointerEvents="none" />
              <View style={[styles.vGridLine, { left: '25%' }]} pointerEvents="none" />
              <View style={[styles.vGridLine, { left: '50%' }]} pointerEvents="none" />
              <View style={[styles.vGridLine, { left: '75%' }]} pointerEvents="none" />

              <View style={styles.barsRow24}>
                {currentDay.hours.map(bucket => {
                  const isSelected = selectedHour === bucket.hour
                  const isPeak = currentDay.peakHour === bucket.hour && bucket.kwh > 0.05
                  const ratio = hourlyMax > 0 ? Math.min(1, bucket.kwh / hourlyMax) : 0
                  const barHeightPct = bucket.kwh > 0
                    ? Math.max(6, Math.round(ratio * 100))
                    : 2

                  return (
                    <Pressable
                      key={`h-${bucket.hour}`}
                      onPress={() => {
                        hapticTick()
                        setSelectedHour(prev => (prev === bucket.hour ? null : bucket.hour))
                      }}
                      style={styles.barSlot24}
                      accessibilityRole="button"
                      accessibilityLabel={`${bucket.rangeLabel} 耗电 ${bucket.kwh} 度`}
                    >
                      <View
                        style={[
                          styles.barColumn24,
                          {
                            height: `${barHeightPct}%`,
                            backgroundColor: isSelected
                              ? colors.text
                              : isPeak
                                ? colors.iosAmber
                                : bucket.kwh > 0
                                  ? colors.iosBlue
                                  : colors.barIdle,
                            opacity: selectedHour !== null && !isSelected ? 0.42 : 1
                          }
                        ]}
                      />
                    </Pressable>
                  )
                })}
              </View>

              <View style={styles.xAxisRow24}>
                <Text style={styles.xAxisTick}>00时</Text>
                <Text style={styles.xAxisTick}>06时</Text>
                <Text style={styles.xAxisTick}>12时</Text>
                <Text style={styles.xAxisTick}>18时</Text>
              </View>
            </View>

            <View style={styles.rightYAxis}>
              <Text style={styles.yAxisText}>{formatNumberCompact(hourlyMax, 1)}度</Text>
              <Text style={styles.yAxisText}>{formatNumberCompact(hourlyMax / 2, 1)}度</Text>
              <Text style={styles.yAxisText}>0度</Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* ==================== 视图 2：近 10 日每日总耗电柱状图 ==================== */}
      {activeTab === 'daily' ? (
        <View>
          <View style={styles.calloutRow}>
            <View style={styles.calloutLeft}>
              <Text style={styles.calloutLabel}>
                {selectedDailyBar ? selectedDailyBar.label : '日均耗电'}
              </Text>
              <View style={styles.calloutValueRow}>
                <Text style={styles.calloutValue}>
                  {selectedDailyBar
                    ? formatNumberCompact(selectedDailyBar.kwh, 2)
                    : (dailyAverage !== null ? formatNumberCompact(dailyAverage, 1) : '--')}
                </Text>
                <Text style={styles.calloutUnit}>度</Text>
              </View>
            </View>

            {selectedDailyBar ? (
              <Pressable
                onPress={() => handleJumpToDayHourly(selectedDailyBar.dateKey)}
                style={({ pressed }) => [styles.drillDownChip, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="查看当日24小时分时图"
              >
                <Text style={styles.drillDownText}>分时明细 ›</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.hourlyChartWrap}>
            <View style={styles.hourlyBarsArea}>
              <View style={[styles.hGridLine, { top: '25%' }]} pointerEvents="none" />
              <View style={[styles.hGridLine, { top: '62%' }]} pointerEvents="none" />

              {dailyAverage !== null && dailyMax > 0 ? (
                <View
                  pointerEvents="none"
                  style={[
                    styles.avgReferenceLine,
                    {
                      bottom: 22 + Math.min(1, Math.max(0, dailyAverage / dailyMax)) * (CHART_HEIGHT - 28)
                    }
                  ]}
                >
                  <Text style={styles.avgReferenceTag}>均值 {formatNumberCompact(dailyAverage, 1)}度</Text>
                </View>
              ) : null}

              <View style={styles.barsRowDaily}>
                {recentDailyBars.map((bar, index) => {
                  const isSelected = selectedDailyIndex === index
                  const ratio = dailyMax > 0 ? Math.min(1, bar.kwh / dailyMax) : 0
                  const barHeightPct = bar.kwh > 0 ? Math.max(7, Math.round(ratio * 100)) : 3
                  const aboveAvg = dailyAverage !== null && bar.kwh > dailyAverage * 1.25

                  return (
                    <Pressable
                      key={bar.dateKey}
                      onPress={() => {
                        hapticTick()
                        setSelectedDailyIndex(prev => (prev === index ? null : index))
                      }}
                      style={styles.dailySlot}
                      accessibilityRole="button"
                      accessibilityLabel={`${bar.shortLabel} 耗电 ${bar.kwh} 度`}
                    >
                      <View style={styles.dailyBarTrack}>
                        <View
                          style={[
                            styles.dailyBarCol,
                            {
                              height: `${barHeightPct}%`,
                              backgroundColor: isSelected
                                ? colors.text
                                : aboveAvg
                                  ? colors.iosAmber
                                  : bar.isToday
                                    ? colors.iosGreen
                                    : colors.barRecent,
                              opacity: selectedDailyIndex !== null && !isSelected ? 0.45 : 1
                            }
                          ]}
                        />
                      </View>
                      <Text
                        style={[
                          styles.dailyXLabel,
                          (bar.isToday || isSelected) && styles.dailyXLabelActive
                        ]}
                      >
                        {bar.weekdayShort}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </View>

            <View style={styles.rightYAxis}>
              <Text style={styles.yAxisText}>{formatNumberCompact(dailyMax, 0)}度</Text>
              <Text style={styles.yAxisText}>{formatNumberCompact(dailyMax / 2, 1)}度</Text>
              <Text style={styles.yAxisText}>0度</Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* ==================== 视图 3：余量曲线与耗尽预测 ==================== */}
      {activeTab === 'balance' ? (
        <View>
          <View style={styles.calloutRow}>
            <View style={styles.calloutLeft}>
              <Text style={styles.calloutLabel}>
                {selectedBalancePoint
                  ? formatUpdatedAt(selectedBalancePoint.createdAt)
                  : '剩余电量'}
              </Text>
              <View style={styles.calloutValueRow}>
                <Text style={styles.calloutValue}>
                  {selectedBalancePoint ? formatNumberCompact(selectedBalancePoint.kwh, 2) : '--'}
                </Text>
                <Text style={styles.calloutUnit}>度</Text>
                {selectedBalancePoint?.recharged ? (
                  <View style={styles.rechargeBadge}>
                    <Text style={styles.rechargeBadgeText}>已充电</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {points.length > 2 ? (
              <Pressable
                onPress={() => {
                  hapticLight()
                  setDetailModalVisible(true)
                }}
                style={({ pressed }) => [styles.drillDownChip, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="打开全屏长历史趋势图"
              >
                <Text style={styles.drillDownText}>全屏 ›</Text>
              </Pressable>
            ) : null}
          </View>

          {previewBalancePoints.length === 0 ? (
            <Text style={styles.emptyText}>暂无历史记录</Text>
          ) : (
            <BalanceLineCanvas
              fluid
              points={previewBalancePoints}
              forecastPoints={forecastPoints}
              threshold={threshold}
              width={lineWidth}
              height={CHART_HEIGHT}
              selectedIndex={selectedBalanceIdx}
              onSelectPoint={idx => setSelectedBalanceIdx(prev => (prev === idx ? null : idx))}
              onLayout={event => {
                const nextW = Math.round(event.nativeEvent.layout.width)
                if (nextW !== lineWidth) setLineWidth(nextW)
              }}
            />
          )}
        </View>
      ) : null}

      <Modal
        animationType="slide"
        visible={detailModalVisible}
        onShow={() => detailScrollRef.current?.scrollToEnd({ animated: false })}
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalScreen}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>14 天电量曲线</Text>
            <Pressable
              onPress={() => {
                hapticLight()
                setDetailModalVisible(false)
              }}
              style={({ pressed }) => [styles.modalCloseBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="关闭全屏趋势图"
            >
              <Text style={styles.modalCloseText}>完成</Text>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            ref={detailScrollRef}
            showsHorizontalScrollIndicator
            contentContainerStyle={styles.modalScrollContent}
          >
            <BalanceLineCanvas
              points={detailBalancePoints}
              forecastPoints={forecastPoints}
              threshold={threshold}
              width={Math.max(360, detailBalancePoints.length * DETAIL_POINT_WIDTH)}
              height={DETAIL_CHART_HEIGHT}
              selectedIndex={null}
            />
          </ScrollView>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
    padding: spacing.xl,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    ...cardShadow
  },
  segmented: {
    marginBottom: spacing.lg
  },
  calloutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.sm
  },
  calloutLeft: {
    flex: 1
  },
  calloutLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
    fontVariant: ['tabular-nums']
  },
  calloutValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 2,
    gap: 4
  },
  calloutValue: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -1,
    fontVariant: ['tabular-nums']
  },
  calloutUnit: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600'
  },
  rightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  demoChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.iosBlueSurface
  },
  demoChipActive: {
    backgroundColor: colors.iosAmberSurface
  },
  demoChipText: {
    color: colors.iosBlue,
    fontSize: 11,
    fontWeight: '600'
  },
  demoChipTextActive: {
    color: colors.iosAmberDark
  },
  dayPager: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.control,
    borderRadius: radii.pill,
    paddingHorizontal: 4,
    paddingVertical: 3,
    gap: 4
  },
  pagerBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pagerBtnText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 18
  },
  pagerDateText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 2,
    fontVariant: ['tabular-nums']
  },
  drillDownChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.iosBlueSurface
  },
  drillDownText: {
    color: colors.iosBlue,
    fontSize: 11,
    fontWeight: '600'
  },
  rechargeBadge: {
    marginLeft: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.iosAmberSurface
  },
  rechargeBadgeText: {
    color: colors.iosAmberDark,
    fontSize: 11,
    fontWeight: '600'
  },
  hourlyChartWrap: {
    flexDirection: 'row',
    height: CHART_HEIGHT,
    alignItems: 'stretch'
  },
  hourlyBarsArea: {
    flex: 1,
    position: 'relative',
    paddingBottom: 22,
    borderBottomWidth: hairlineWidth,
    borderBottomColor: colors.separator
  },
  hGridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: hairlineWidth,
    backgroundColor: colors.separator
  },
  vGridLine: {
    position: 'absolute',
    top: 0,
    bottom: 22,
    width: hairlineWidth,
    backgroundColor: colors.separator
  },
  barsRow24: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 2,
    gap: 3
  },
  barSlot24: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center'
  },
  barColumn24: {
    width: '100%',
    borderTopLeftRadius: 2.5,
    borderTopRightRadius: 2.5,
    minHeight: 2
  },
  xAxisRow24: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingRight: '18%'
  },
  xAxisTick: {
    color: colors.textFaint,
    fontSize: 11,
    fontVariant: ['tabular-nums']
  },
  rightYAxis: {
    width: 38,
    paddingBottom: 22,
    justifyContent: 'space-between',
    alignItems: 'flex-end'
  },
  yAxisText: {
    color: colors.textFaint,
    fontSize: 11,
    fontVariant: ['tabular-nums']
  },
  barsRowDaily: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 4,
    gap: 8
  },
  dailySlot: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end'
  },
  dailyBarTrack: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center'
  },
  dailyBarCol: {
    width: '78%',
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    minHeight: 3
  },
  dailyXLabel: {
    marginTop: 5,
    color: colors.textFaint,
    fontSize: 11,
    fontVariant: ['tabular-nums']
  },
  dailyXLabelActive: {
    color: colors.text,
    fontWeight: '700'
  },
  avgReferenceLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.iosAmber,
    zIndex: 5
  },
  avgReferenceTag: {
    position: 'absolute',
    right: 4,
    top: -15,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: colors.iosAmberSurface,
    color: colors.iosAmberDark,
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums']
  },
  lineCanvas: {
    position: 'relative',
    borderRadius: radii.control,
    backgroundColor: colors.surfaceSubtle,
    overflow: 'hidden'
  },
  lineCanvasFluid: {
    width: '100%'
  },
  lineSegment: {
    position: 'absolute',
    height: 2.5,
    borderRadius: radii.pill,
    backgroundColor: colors.iosBlue,
    transformOrigin: 'left center'
  },
  rechargeSegment: {
    backgroundColor: colors.iosAmber
  },
  forecastSegment: {
    position: 'absolute',
    height: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.iosTeal,
    opacity: 0.55,
    transformOrigin: 'left center'
  },
  thresholdLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.iosRed
  },
  thresholdLineTag: {
    position: 'absolute',
    left: 8,
    top: -15,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: colors.iosRedSurface,
    color: colors.iosRedDark,
    fontSize: 11,
    fontWeight: '600'
  },
  pointHitBox: {
    position: 'absolute',
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pointDot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.surface
  },
  currentDot: {
    backgroundColor: colors.iosBlue
  },
  selectedDot: {
    width: 10,
    height: 10,
    backgroundColor: colors.text
  },
  rechargeDot: {
    backgroundColor: colors.iosAmber
  },
  canvasYLabel: {
    position: 'absolute',
    right: 8,
    color: colors.textFaint,
    fontSize: 11,
    fontVariant: ['tabular-nums']
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    paddingVertical: spacing.lg,
    textAlign: 'center'
  },
  modalScreen: {
    flex: 1,
    paddingTop: 52,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.background
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg
  },
  modalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700'
  },
  modalCloseBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.surface
  },
  modalCloseText: {
    color: colors.iosBlue,
    fontSize: 13,
    fontWeight: '600'
  },
  modalScrollContent: {
    paddingVertical: spacing.md
  },
  disabled: {
    opacity: 0.35
  },
  pressed: {
    opacity: 0.68
  }
})
