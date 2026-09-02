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
import { colors, radii, spacing } from '../theme'

interface TrendChartProps {
  points: HistoryPoint[]
}

interface LinePlotProps {
  points: HistoryPoint[]
  width: number
  height: number
  min: number
  range: number
  timeStart: number
  timeRange: number
  fluid?: boolean
  onLayout?: (event: LayoutChangeEvent) => void
}

const CHART_HEIGHT = 170
const DETAIL_CHART_HEIGHT = 240
const CHART_PADDING = 10
const DETAIL_POINT_WIDTH = 14
const PREVIEW_POINT_LIMIT = 48
const DETAIL_POINT_LIMIT = 336
const GRID_RATIOS = [0.25, 0.5, 0.75]

function formatKwh(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function formatTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${month}-${day} ${hour}:${minute}`
}

interface ChartMetrics {
  min: number
  max: number
  range: number
  timeStart: number
  timeRange: number
}

function getChartMetrics(points: HistoryPoint[]): ChartMetrics {
  const values = points.map(point => point.kwh)
  const dataMin = values.length ? Math.min(...values) : 0
  const dataMax = values.length ? Math.max(...values) : 1
  const isFlat = values.length > 0 && dataMin === dataMax
  const min = isFlat ? Math.max(0, dataMin - 1) : dataMin
  const max = isFlat ? dataMax + 1 : dataMax
  const timestamps = points
    .map(point => Date.parse(point.createdAt))
    .filter(timestamp => Number.isFinite(timestamp))
  const timeStart = timestamps.length ? Math.min(...timestamps) : 0
  const timeEnd = timestamps.length ? Math.max(...timestamps) : 0

  return {
    min,
    max,
    range: Math.max(max - min, 1),
    timeStart,
    timeRange: Math.max(timeEnd - timeStart, 0)
  }
}

function LinePlot({ points, width, height, min, range, timeStart, timeRange, fluid = false, onLayout }: LinePlotProps) {
  const coordinates = useMemo(() => {
    if (!width || points.length === 0) return []
    const usableWidth = Math.max(width - CHART_PADDING * 2, 1)
    const usableHeight = height - CHART_PADDING * 2
    const hasTimeRange = timeRange > 0
    return points.map((point, index) => ({
      x: CHART_PADDING + (points.length === 1
        ? usableWidth / 2
        : (hasTimeRange && Number.isFinite(Date.parse(point.createdAt))
          ? Math.min(1, Math.max(0, (Date.parse(point.createdAt) - timeStart) / timeRange))
          : index / (points.length - 1)) * usableWidth),
      y: CHART_PADDING + (1 - (point.kwh - min) / range) * usableHeight,
      recharged: point.recharged
    }))
  }, [height, min, points, range, timeRange, timeStart, width])

  return (
    <View
      onLayout={onLayout}
      style={[styles.chart, fluid ? styles.chartFluid : null, { height, width: fluid ? undefined : width }]}
    >
      {GRID_RATIOS.map(ratio => (
        <View
          key={`grid-${ratio}`}
          pointerEvents="none"
          style={[styles.gridLine, { top: CHART_PADDING + ratio * (height - CHART_PADDING * 2) }]}
        />
      ))}
      {coordinates.slice(1).map((point, index) => {
        const previous = coordinates[index]
        const dx = point.x - previous.x
        const dy = point.y - previous.y
        const length = Math.sqrt(dx * dx + dy * dy)
        const angle = Math.atan2(dy, dx) * 180 / Math.PI
        return (
          <View
            key={`segment-${index}`}
            style={[styles.segment, point.recharged && styles.rechargeSegment, {
              left: previous.x,
              top: previous.y - 1,
              width: length,
              transform: [{ rotate: `${angle}deg` }]
            }]}
          />
        )
      })}
      {coordinates.map((point, index) => {
        const isCurrent = index === coordinates.length - 1
        if (!point.recharged && !isCurrent) return null

        const markerSize = point.recharged ? 10 : 8
        return (
          <View
            key={`point-${index}`}
            style={[styles.point, point.recharged ? styles.rechargePoint : styles.currentPoint, {
              left: point.x - markerSize / 2,
              top: point.y - markerSize / 2
            }]}
          />
        )
      })}
    </View>
  )
}

export function TrendChart({ points }: TrendChartProps) {
  const [width, setWidth] = useState(0)
  const [detailVisible, setDetailVisible] = useState(false)
  const detailScrollRef = useRef<ScrollView>(null)
  const previewPoints = points.slice(-PREVIEW_POINT_LIMIT)
  const detailPoints = points.slice(-DETAIL_POINT_LIMIT)
  const previewMetrics = getChartMetrics(previewPoints)
  const detailMetrics = getChartMetrics(detailPoints)
  const hasRecharge = previewPoints.some(point => point.recharged)
  const detailWidth = Math.max(
    300,
    Math.ceil(CHART_PADDING * 2 + (detailMetrics.timeRange / (60 * 60 * 1000)) * DETAIL_POINT_WIDTH)
  )

  function handleLayout(event: LayoutChangeEvent) {
    const nextWidth = Math.round(event.nativeEvent.layout.width)
    if (nextWidth !== width) setWidth(nextWidth)
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>用电趋势</Text>
        {hasRecharge ? (
          <View style={styles.legend}>
            <View style={styles.legendDot} />
            <Text style={styles.legendText}>充电</Text>
          </View>
        ) : null}
      </View>

      {previewPoints.length === 0 ? (
        <Text style={styles.empty}>暂无趋势数据</Text>
      ) : (
        <Pressable
          accessibilityLabel="查看用电趋势"
          accessibilityRole="button"
          onPress={() => setDetailVisible(true)}
          style={styles.preview}
        >
          <View style={styles.chartRow}>
            <View style={styles.yAxis}>
              <Text style={styles.axisText}>{formatKwh(previewMetrics.max)}度</Text>
              <Text style={styles.axisText}>{formatKwh(previewMetrics.min)}度</Text>
            </View>
            <LinePlot
              fluid
              height={CHART_HEIGHT}
              min={previewMetrics.min}
              onLayout={handleLayout}
              points={previewPoints}
              range={previewMetrics.range}
              timeRange={previewMetrics.timeRange}
              timeStart={previewMetrics.timeStart}
              width={width}
            />
          </View>
          <View style={styles.timeAxis}>
            {previewPoints.length === 1 ? (
              <Text style={[styles.axisText, styles.singleTimeLabel]}>{formatTime(previewPoints[0].createdAt)}</Text>
            ) : (
              <>
                <Text style={styles.axisText}>{formatTime(previewPoints[0].createdAt)}</Text>
                <Text style={styles.axisText}>{formatTime(previewPoints[previewPoints.length - 1].createdAt)}</Text>
              </>
            )}
          </View>
        </Pressable>
      )}

      <Modal
        animationType="slide"
        onShow={() => detailScrollRef.current?.scrollTo({ x: 0, y: 0, animated: false })}
        onRequestClose={() => setDetailVisible(false)}
        transparent={false}
        visible={detailVisible}
      >
        <View style={styles.detailScreen}>
          <View style={styles.detailHeader}>
            <Text style={styles.detailTitle}>用电趋势</Text>
            <Pressable
              accessibilityLabel="关闭趋势详情"
              accessibilityRole="button"
              onPress={() => setDetailVisible(false)}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>关闭</Text>
            </Pressable>
          </View>

          {detailPoints.length === 0 ? (
            <Text style={styles.empty}>暂无趋势数据</Text>
          ) : (
            <View style={styles.detailChartRow}>
              <View style={styles.detailYAxis}>
                <Text style={styles.axisText}>{formatKwh(detailMetrics.max)}度</Text>
                <Text style={styles.axisText}>{formatKwh(detailMetrics.min)}度</Text>
              </View>
              <ScrollView
                horizontal
                ref={detailScrollRef}
                showsHorizontalScrollIndicator
                showsVerticalScrollIndicator={false}
                style={styles.detailScroll}
              >
                <View style={[styles.detailContent, { width: detailWidth }]}>
                  <LinePlot
                    height={DETAIL_CHART_HEIGHT}
                    min={detailMetrics.min}
                    points={detailPoints}
                    range={detailMetrics.range}
                    timeRange={detailMetrics.timeRange}
                    timeStart={detailMetrics.timeStart}
                    width={detailWidth}
                  />
                  <View style={styles.detailTimeAxis}>
                    {detailPoints.length === 1 ? (
                      <Text style={[styles.axisText, styles.singleTimeLabel]}>{formatTime(detailPoints[0].createdAt)}</Text>
                    ) : (
                      <>
                        <Text style={styles.axisText}>{formatTime(detailPoints[0].createdAt)}</Text>
                        <Text style={styles.axisText}>{formatTime(detailPoints[detailPoints.length - 1].createdAt)}</Text>
                      </>
                    )}
                  </View>
                </View>
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.lg,
    padding: spacing.xl,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700'
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.recharge
  },
  legendText: {
    color: colors.textMuted,
    fontSize: 12
  },
  preview: {
    borderRadius: radii.small
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: spacing.lg
  },
  yAxis: {
    width: 46,
    justifyContent: 'space-between',
    paddingVertical: CHART_PADDING
  },
  chart: {
    overflow: 'hidden',
    borderRadius: radii.small,
    backgroundColor: colors.control
  },
  chartFluid: {
    flex: 1
  },
  segment: {
    position: 'absolute',
    height: 3,
    borderRadius: radii.pill,
    transformOrigin: 'left center',
    backgroundColor: colors.textSecondary
  },
  rechargeSegment: {
    backgroundColor: colors.recharge
  },
  gridLine: {
    position: 'absolute',
    left: CHART_PADDING,
    right: CHART_PADDING,
    height: 1,
    backgroundColor: 'rgba(20, 24, 32, 0.07)'
  },
  point: {
    position: 'absolute',
    borderRadius: radii.pill
  },
  currentPoint: {
    width: 8,
    height: 8,
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: colors.accent
  },
  rechargePoint: {
    width: 10,
    height: 10,
    borderWidth: 2,
    borderColor: colors.recharge,
    backgroundColor: colors.surface
  },
  empty: {
    paddingVertical: 52,
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center'
  },
  timeAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingLeft: 52
  },
  axisText: {
    color: colors.textFaint,
    fontSize: 11
  },
  singleTimeLabel: {
    flex: 1,
    textAlign: 'center'
  },
  detailScreen: {
    flex: 1,
    paddingTop: 48,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.background
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  detailTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800'
  },
  closeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surface
  },
  closeButtonText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600'
  },
  detailChartRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.xl
  },
  detailYAxis: {
    width: 50,
    height: DETAIL_CHART_HEIGHT,
    justifyContent: 'space-between',
    paddingVertical: CHART_PADDING
  },
  detailScroll: {
    flex: 1
  },
  detailContent: {
    paddingRight: spacing.xl
  },
  detailTimeAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingHorizontal: CHART_PADDING
  }
})
