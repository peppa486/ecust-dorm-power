import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { cardShadow, colors, hairlineWidth, radii, spacing } from '../theme'
import type { HeatmapRow, PeriodShare } from '../utils/analytics'
import { hapticTick } from '../utils/haptics'
import { formatNumberCompact } from '../utils/power'

interface PatternInsightsCardProps {
  periods: PeriodShare[]
  heatmap: HeatmapRow[]
  rechargeCount: number
  lastRechargeAmount: number | null
}

function pad2(val: number): string {
  return String(val).padStart(2, '0')
}

const HEATMAP_LEVEL_COLORS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: colors.heat0,
  1: colors.heat1,
  2: colors.heat2,
  3: colors.heat3,
  4: colors.heat4
}

export function PatternInsightsCard({
  periods,
  heatmap,
  rechargeCount
}: PatternInsightsCardProps) {
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null)
  const [selectedCell, setSelectedCell] = useState<{
    dateLabel: string
    hour: number
    kwh: number
  } | null>(null)

  const totalPeriodKwh = periods.reduce((sum, item) => sum + item.kwh, 0)

  return (
    <View style={styles.card}>
      {/* 第一部分：时段占比 */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>时段占比</Text>
        {rechargeCount > 0 ? (
          <View style={styles.rechargeTag}>
            <Text style={styles.rechargeTagText}>已充 {rechargeCount} 次</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.proportionalBar}>
        {totalPeriodKwh > 0.01 ? (
          periods.map(period => {
            if (period.percentage <= 0) return null
            const isSelected = selectedPeriodId === period.id
            return (
              <Pressable
                key={period.id}
                onPress={() => {
                  hapticTick()
                  setSelectedPeriodId(prev => (prev === period.id ? null : period.id))
                }}
                style={[
                  styles.proportionalSegment,
                  {
                    flex: Math.max(period.percentage, 4),
                    backgroundColor: period.color,
                    opacity: selectedPeriodId && !isSelected ? 0.38 : 1
                  }
                ]}
              />
            )
          })
        ) : (
          <View style={[styles.proportionalSegment, { flex: 1, backgroundColor: colors.control }]} />
        )}
      </View>

      <View style={styles.legendGrid}>
        {periods.map(period => {
          const isSelected = selectedPeriodId === period.id
          return (
            <Pressable
              key={period.id}
              onPress={() => {
                hapticTick()
                setSelectedPeriodId(prev => (prev === period.id ? null : period.id))
              }}
              style={({ pressed }) => [styles.legendCard, isSelected && styles.legendCardActive, pressed && { opacity: 0.7 }]}
            >
              <View style={styles.legendTopRow}>
                <View style={styles.legendTitleRow}>
                  <View style={[styles.legendDot, { backgroundColor: period.color }]} />
                  <Text style={styles.legendLabel}>{period.label}</Text>
                </View>
                <Text style={styles.legendPct}>{period.percentage}%</Text>
              </View>
              <View style={styles.legendBottomRow}>
                <Text style={styles.legendTime}>{period.rangeLabel}</Text>
                <Text style={styles.legendKwh}>{formatNumberCompact(period.kwh, 1)}度</Text>
              </View>
            </Pressable>
          )
        })}
      </View>

      <View style={styles.divider} />

      {/* 第二部分：7×24h 热力图 */}
      <View style={styles.heatmapHeader}>
        <Text style={styles.sectionTitle}>7 × 24h 热力图</Text>

        {selectedCell ? (
          <Text style={styles.cellCallout}>
            {selectedCell.dateLabel} {pad2(selectedCell.hour)}:00 · {formatNumberCompact(selectedCell.kwh, 2)}度
          </Text>
        ) : (
          <View style={styles.scaleRow}>
            <Text style={styles.scaleLabel}>低</Text>
            {([0, 1, 2, 3, 4] as const).map(lvl => (
              <View
                key={`lvl-${lvl}`}
                style={[styles.scaleSwatch, { backgroundColor: HEATMAP_LEVEL_COLORS[lvl] }]}
              />
            ))}
            <Text style={styles.scaleLabel}>高</Text>
          </View>
        )}
      </View>

      <View style={styles.heatmapHourRuler}>
        <View style={styles.heatmapDayColSpacer} />
        <View style={styles.heatmapHoursHeaderRow}>
          <Text style={styles.heatmapHourTick}>00时</Text>
          <Text style={styles.heatmapHourTick}>06时</Text>
          <Text style={styles.heatmapHourTick}>12时</Text>
          <Text style={styles.heatmapHourTick}>18时</Text>
          <Text style={styles.heatmapHourTick}>23时</Text>
        </View>
      </View>

      <View style={styles.heatmapMatrix}>
        {heatmap.map((row, rowIndex) => (
          <View key={row.dateKey} style={styles.heatmapRow}>
            <Text style={[styles.heatmapDayLabel, rowIndex === 0 && styles.heatmapDayLabelToday]}>
              {rowIndex === 0 ? '今天' : rowIndex === 1 ? '昨天' : `${row.shortLabel}日`}
            </Text>
            <View style={styles.heatmapCellsWrap}>
              {row.cells.map(cell => {
                const isCellSelected =
                  selectedCell?.dateLabel === row.label && selectedCell?.hour === cell.hour
                return (
                  <Pressable
                    key={`${row.dateKey}-${cell.hour}`}
                    onPress={() => {
                      hapticTick()
                      setSelectedCell(prev =>
                        prev && prev.dateLabel === row.label && prev.hour === cell.hour
                          ? null
                          : { dateLabel: row.label, hour: cell.hour, kwh: cell.kwh }
                      )
                    }}
                    style={[
                      styles.heatmapCell,
                      {
                        backgroundColor: HEATMAP_LEVEL_COLORS[cell.level]
                      },
                      isCellSelected && styles.heatmapCellSelected
                    ]}
                  />
                )
              })}
            </View>
          </View>
        ))}
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3
  },
  rechargeTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.iosAmberSurface
  },
  rechargeTagText: {
    color: colors.iosAmberDark,
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums']
  },
  proportionalBar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    gap: 2.5,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.control
  },
  proportionalSegment: {
    height: '100%',
    borderRadius: 3
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  legendCard: {
    width: '48.5%',
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: radii.control,
    backgroundColor: colors.surfaceSubtle
  },
  legendCardActive: {
    backgroundColor: colors.iosBlueSurface
  },
  legendTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  legendTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill
  },
  legendLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600'
  },
  legendPct: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums']
  },
  legendBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4
  },
  legendTime: {
    color: colors.textFaint,
    fontSize: 11,
    fontVariant: ['tabular-nums']
  },
  legendKwh: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '500',
    fontVariant: ['tabular-nums']
  },
  divider: {
    height: hairlineWidth,
    backgroundColor: colors.separator,
    marginVertical: spacing.lg
  },
  heatmapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm
  },
  cellCallout: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums']
  },
  scaleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3
  },
  scaleLabel: {
    color: colors.textFaint,
    fontSize: 11,
    marginHorizontal: 2
  },
  scaleSwatch: {
    width: 9,
    height: 9,
    borderRadius: 2
  },
  heatmapHourRuler: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4
  },
  heatmapDayColSpacer: {
    width: 36
  },
  heatmapHoursHeaderRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  heatmapHourTick: {
    color: colors.textFaint,
    fontSize: 11,
    fontVariant: ['tabular-nums']
  },
  heatmapMatrix: {
    gap: 4
  },
  heatmapRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  heatmapDayLabel: {
    width: 36,
    color: colors.textMuted,
    fontSize: 11,
    fontVariant: ['tabular-nums']
  },
  heatmapDayLabelToday: {
    color: colors.text,
    fontWeight: '700'
  },
  heatmapCellsWrap: {
    flex: 1,
    flexDirection: 'row',
    gap: 2
  },
  heatmapCell: {
    flex: 1,
    height: 13,
    borderRadius: 2.5
  },
  heatmapCellSelected: {
    borderWidth: 1.5,
    borderColor: colors.text
  }
})
