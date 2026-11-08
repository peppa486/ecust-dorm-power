import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

import { cardShadow, colors, hairlineWidth, radii, spacing } from '../theme'
import type { PowerResult } from '../types/api'
import type { PowerAnalyticsSummary } from '../utils/analytics'
import { displayKwh, formatNumberCompact, formatUpdatedAt, getPowerStatus } from '../utils/power'

interface HeroTelemetryCardProps {
  result: PowerResult | null
  summary: PowerAnalyticsSummary
  threshold: number
  isMine: boolean
  busy?: boolean
  refreshing?: boolean
  onRefresh?: () => void
  onSetMine?: () => void
  onRemoveMine?: () => void
  onOpenRoomSwitcher?: () => void
}

export function HeroTelemetryCard({
  result,
  summary,
  threshold,
  isMine,
  busy = false,
  refreshing = false,
  onRefresh,
  onSetMine,
  onRemoveMine,
  onOpenRoomSwitcher
}: HeroTelemetryCardProps) {
  const kwh = result?.kwh ?? summary.current ?? 0
  const hasReading = result !== null || summary.current !== null
  const status = getPowerStatus(kwh, threshold)
  const updatedAt = result?.updatedAt ? formatUpdatedAt(result.updatedAt) : ''

  // 容量进度条：以 100 度为满格参考（若当前超过 100 度则以当前值向上取整）
  const maxReference = Math.max(100, Math.ceil(kwh / 50) * 50)
  const fillRatio = hasReading ? Math.max(0.03, Math.min(1, kwh / maxReference)) : 0
  const thresholdRatio = Math.max(0.05, Math.min(0.95, threshold / maxReference))

  const barColor = status.tone === 'danger'
    ? colors.iosRed
    : status.tone === 'warning'
      ? colors.iosAmber
      : colors.iosGreen

  return (
    <View style={styles.card}>
      {/* 顶部小标题与更新时间 */}
      <View style={styles.eyebrowRow}>
        <View style={styles.eyebrowLeft}>
          <Text style={styles.eyebrowLabel}>当前剩余电量</Text>
          {result?.cached ? <Text style={styles.cacheTag}>缓存</Text> : null}
        </View>
        <View style={styles.eyebrowRight}>
          {updatedAt ? <Text style={styles.updatedText}>更新于 {updatedAt}</Text> : null}
          {onRefresh ? (
            <Pressable
              onPress={onRefresh}
              disabled={refreshing}
              hitSlop={10}
              style={({ pressed }) => [styles.refreshPill, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="刷新当前电量"
            >
              {refreshing ? (
                <ActivityIndicator size="small" color={colors.iosBlue} />
              ) : (
                <Text style={styles.refreshText}>刷新</Text>
              )}
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* 核心超大度数与状态胶囊 */}
      <View style={styles.heroRow}>
        <View style={styles.numberBlock}>
          <Text style={styles.heroValue}>
            {result ? displayKwh(result) : (summary.current !== null ? formatNumberCompact(summary.current, 2) : '--')}
          </Text>
          <Text style={styles.heroUnit}>度 (kWh)</Text>
        </View>

        {hasReading ? (
          <View style={[styles.statusBadge, styles[`badge_${status.tone}`]]}>
            <View style={[styles.statusDot, styles[`dot_${status.tone}`]]} />
            <Text style={[styles.statusText, styles[`text_${status.tone}`]]}>{status.label}</Text>
          </View>
        ) : null}
      </View>

      {/* iOS 电池风格容量条（含阈值刻度线） */}
      <View style={styles.capacitySection}>
        <View style={styles.capacityTrack}>
          <View
            style={[
              styles.capacityFill,
              {
                width: `${Math.round(fillRatio * 100)}%`,
                backgroundColor: barColor
              }
            ]}
          />
          <View
            style={[
              styles.thresholdMarker,
              { left: `${Math.round(thresholdRatio * 100)}%` }
            ]}
          />
        </View>
        <View style={styles.capacitySubRow}>
          <Text style={styles.capacityHint}>{summary.estimatedDepletionLabel}</Text>
          <Text style={styles.capacityHint}>预警线 {threshold} 度</Text>
        </View>
      </View>

      {/* 四宫格核心统计指标 */}
      <View style={styles.kpiGrid}>
        <View style={styles.kpiItem}>
          <Text style={styles.kpiLabel}>预计可用</Text>
          <Text style={styles.kpiValue}>
            {summary.estimatedDays !== null ? `${formatNumberCompact(summary.estimatedDays, 1)}天` : '--'}
          </Text>
        </View>
        <View style={styles.kpiDivider} />
        <View style={styles.kpiItem}>
          <Text style={styles.kpiLabel}>24h 耗电</Text>
          <Text style={styles.kpiValue}>
            {summary.consumed24h !== null ? `${formatNumberCompact(summary.consumed24h, 1)}度` : '--'}
          </Text>
        </View>
        <View style={styles.kpiDivider} />
        <View style={styles.kpiItem}>
          <Text style={styles.kpiLabel}>日均耗电</Text>
          <Text style={styles.kpiValue}>
            {summary.dailyAverage !== null ? `${formatNumberCompact(summary.dailyAverage, 1)}度` : '--'}
          </Text>
        </View>
        <View style={styles.kpiDivider} />
        <View style={styles.kpiItem}>
          <Text style={styles.kpiLabel}>高峰时段</Text>
          <Text style={styles.kpiValueSmall} numberOfLines={1}>
            {summary.peakWindowLabel}
          </Text>
        </View>
      </View>

      {/* 寝室归属操作栏 */}
      <View style={styles.footerRow}>
        <Text style={styles.roomMetaText} numberOfLines={1}>
          {result?.displayName || '尚未选择寝室'}
        </Text>

        <View style={styles.footerActions}>
          {onOpenRoomSwitcher ? (
            <Pressable
              onPress={onOpenRoomSwitcher}
              style={({ pressed }) => [styles.secondaryChip, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="查询其他寝室"
            >
              <Text style={styles.secondaryChipText}>查其他寝室</Text>
            </Pressable>
          ) : null}

          {isMine && onRemoveMine ? (
            <Pressable
              onPress={onRemoveMine}
              disabled={busy}
              style={({ pressed }) => [styles.secondaryChip, pressed && styles.pressed, busy && styles.disabled]}
              accessibilityRole="button"
              accessibilityLabel="取消我的寝室"
            >
              <Text style={styles.secondaryChipText}>{busy ? '处理中…' : '取消绑定'}</Text>
            </Pressable>
          ) : onSetMine && result ? (
            <Pressable
              onPress={onSetMine}
              disabled={busy}
              style={({ pressed }) => [styles.primaryChip, pressed && styles.pressed, busy && styles.disabled]}
              accessibilityRole="button"
              accessibilityLabel="设为我的寝室"
            >
              <Text style={styles.primaryChipText}>{busy ? '处理中…' : '设为我的寝室'}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
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
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  eyebrowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  eyebrowLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600'
  },
  cacheTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 5,
    backgroundColor: colors.control,
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '600'
  },
  eyebrowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  updatedText: {
    color: colors.textFaint,
    fontSize: 12,
    fontVariant: ['tabular-nums']
  },
  refreshPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.iosBlueSurface
  },
  refreshText: {
    color: colors.iosBlue,
    fontSize: 12,
    fontWeight: '600'
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: spacing.sm
  },
  numberBlock: {
    flexDirection: 'row',
    alignItems: 'baseline'
  },
  heroValue: {
    color: colors.text,
    fontSize: 52,
    fontWeight: '700',
    letterSpacing: -2.4,
    fontVariant: ['tabular-nums']
  },
  heroUnit: {
    marginLeft: 6,
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '600'
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radii.pill,
    marginBottom: 8
  },
  badge_good: {
    backgroundColor: colors.iosGreenSurface
  },
  badge_warning: {
    backgroundColor: colors.iosAmberSurface
  },
  badge_danger: {
    backgroundColor: colors.iosRedSurface
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: radii.pill
  },
  dot_good: {
    backgroundColor: colors.iosGreen
  },
  dot_warning: {
    backgroundColor: colors.iosAmber
  },
  dot_danger: {
    backgroundColor: colors.iosRed
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600'
  },
  text_good: {
    color: colors.iosGreenDark
  },
  text_warning: {
    color: colors.iosAmberDark
  },
  text_danger: {
    color: colors.iosRedDark
  },
  capacitySection: {
    marginTop: spacing.md
  },
  capacityTrack: {
    height: 9,
    borderRadius: radii.pill,
    backgroundColor: colors.control,
    overflow: 'hidden',
    position: 'relative'
  },
  capacityFill: {
    height: '100%',
    borderRadius: radii.pill
  },
  thresholdMarker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(28, 28, 30, 0.35)'
  },
  capacitySubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6
  },
  capacityHint: {
    color: colors.textMuted,
    fontSize: 11,
    fontVariant: ['tabular-nums']
  },
  kpiGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: hairlineWidth,
    borderTopColor: colors.separator
  },
  kpiItem: {
    flex: 1,
    alignItems: 'flex-start'
  },
  kpiDivider: {
    width: hairlineWidth,
    height: 26,
    backgroundColor: colors.separator,
    marginHorizontal: 8
  },
  kpiLabel: {
    color: colors.textMuted,
    fontSize: 11
  },
  kpiValue: {
    marginTop: 3,
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums']
  },
  kpiValueSmall: {
    marginTop: 4,
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums']
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: hairlineWidth,
    borderTopColor: colors.separator,
    gap: spacing.sm
  },
  roomMetaText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '500'
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  primaryChip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.iosBlue
  },
  primaryChipText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: '600'
  },
  secondaryChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.control
  },
  secondaryChipText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600'
  },
  disabled: {
    opacity: 0.5
  },
  pressed: {
    opacity: 0.68
  }
})
