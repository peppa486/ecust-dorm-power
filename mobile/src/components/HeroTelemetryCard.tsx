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
  onRemoveMine
}: HeroTelemetryCardProps) {
  const kwh = result?.kwh ?? summary.current ?? 0
  const hasReading = result !== null || summary.current !== null
  const status = getPowerStatus(kwh, threshold)
  const updatedAt = result?.updatedAt ? formatUpdatedAt(result.updatedAt) : ''

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
      {/* 顶栏：寝室名 + 刷新 */}
      <View style={styles.eyebrowRow}>
        <View style={styles.eyebrowLeft}>
          <Text style={styles.eyebrowLabel} numberOfLines={1}>
            {result?.displayName || '剩余电量'}
          </Text>
          {result?.cached ? <Text style={styles.cacheTag}>缓存</Text> : null}
        </View>
        <View style={styles.eyebrowRight}>
          {updatedAt ? <Text style={styles.updatedText}>{updatedAt}</Text> : null}
          {onRefresh ? (
            <Pressable
              onPress={onRefresh}
              disabled={refreshing}
              hitSlop={10}
              style={({ pressed }) => [styles.refreshPill, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="刷新电量"
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
          <Text style={styles.heroUnit}>度</Text>
        </View>

        {hasReading ? (
          <View style={[styles.statusBadge, styles[`badge_${status.tone}`]]}>
            <View style={[styles.statusDot, styles[`dot_${status.tone}`]]} />
            <Text style={[styles.statusText, styles[`text_${status.tone}`]]}>{status.label}</Text>
          </View>
        ) : null}
      </View>

      {/* 容量条 */}
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

      {/* 四宫格核心指标 */}
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

      {/* 绑定操作 */}
      {(isMine && onRemoveMine) || (!isMine && onSetMine && result) ? (
        <View style={styles.footerRow}>
          <Text style={styles.roomMetaText}>
            {isMine ? '已绑定为常住寝室' : '设为常住寝室以记录整点趋势'}
          </Text>
          {isMine && onRemoveMine ? (
            <Pressable
              onPress={onRemoveMine}
              disabled={busy}
              hitSlop={8}
              style={({ pressed }) => [pressed && styles.pressed, busy && styles.disabled]}
              accessibilityRole="button"
              accessibilityLabel="取消绑定"
            >
              <Text style={styles.unbindLink}>{busy ? '处理中…' : '取消绑定'}</Text>
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
      ) : null}
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
    justifyContent: 'space-between',
    gap: spacing.sm
  },
  eyebrowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  eyebrowLabel: {
    flexShrink: 1,
    color: colors.textSecondary,
    fontSize: 14,
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
    gap: 8
  },
  updatedText: {
    color: colors.textFaint,
    fontSize: 12,
    fontVariant: ['tabular-nums']
  },
  refreshPill: {
    paddingHorizontal: 9,
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
    marginTop: 6
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
    fontSize: 16,
    fontWeight: '600'
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
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
  capacityTrack: {
    height: 8,
    marginTop: spacing.md,
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
    height: 24,
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
    color: colors.textMuted,
    fontSize: 12
  },
  primaryChip: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.iosBlue
  },
  primaryChipText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: '600'
  },
  unbindLink: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500'
  },
  disabled: {
    opacity: 0.5
  },
  pressed: {
    opacity: 0.68
  }
})
