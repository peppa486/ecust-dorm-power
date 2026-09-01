import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, radii, spacing } from '../theme'
import { displayKwh, formatUpdatedAt, getPowerStatus } from '../utils/power'
import type { PowerResult } from '../types/api'

interface ResultCardProps {
  result: PowerResult
  isMine?: boolean
  busy?: boolean
  onSetMine?: () => void
  onRemoveMine?: () => void
}

export function ResultCard({ result, isMine = false, busy = false, onSetMine, onRemoveMine }: ResultCardProps) {
  const status = getPowerStatus(result.kwh)
  const updatedAt = formatUpdatedAt(result.updatedAt)

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.caption}>剩余电量</Text>
          <Text style={styles.powerValue}>
            {displayKwh(result)}<Text style={styles.unit}>度</Text>
          </Text>
        </View>
        <View style={[styles.statusPill, styles[`status_${status.tone}`]]}>
          <View style={[styles.statusDot, styles[`dot_${status.tone}`]]} />
          <Text style={[styles.statusText, styles[`statusText_${status.tone}`]]}>{status.label}</Text>
        </View>
      </View>
      <Text style={styles.meta}>
        {result.displayName}
        {result.cached ? ' · 缓存' : ''}
      </Text>
      {updatedAt ? <Text style={styles.updated}>更新于 {updatedAt}</Text> : null}
      {isMine && onRemoveMine ? (
        <Pressable
          onPress={onRemoveMine}
          disabled={busy}
          style={({ pressed }) => [styles.actionButton, styles.removeButton, pressed && styles.pressed, busy && styles.disabled]}
          accessibilityRole="button"
          accessibilityLabel="取消我的寝室"
        >
          <Text style={styles.removeText}>{busy ? '处理中' : '取消我的寝室'}</Text>
        </Pressable>
      ) : onSetMine ? (
        <Pressable
          onPress={onSetMine}
          disabled={busy}
          style={({ pressed }) => [styles.actionButton, styles.setButton, pressed && styles.pressed, busy && styles.disabled]}
          accessibilityRole="button"
          accessibilityLabel="设为我的寝室"
        >
          <Text style={styles.setText}>{busy ? '处理中' : '设为我的寝室'}</Text>
        </Pressable>
      ) : null}
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
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14
  },
  caption: {
    color: colors.textMuted,
    fontSize: 13
  },
  powerValue: {
    marginTop: spacing.xs,
    color: colors.text,
    fontSize: 54,
    fontWeight: '800',
    letterSpacing: -3
  },
  unit: {
    marginLeft: 6,
    color: colors.textSecondary,
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: radii.pill
  },
  status_good: {
    backgroundColor: colors.goodSurface
  },
  status_warning: {
    backgroundColor: colors.warningSurface
  },
  status_danger: {
    backgroundColor: colors.dangerSurface
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: radii.pill
  },
  dot_good: {
    backgroundColor: colors.good
  },
  dot_warning: {
    backgroundColor: colors.warning
  },
  dot_danger: {
    backgroundColor: colors.danger
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600'
  },
  statusText_good: {
    color: colors.good
  },
  statusText_warning: {
    color: colors.warning
  },
  statusText_danger: {
    color: colors.danger
  },
  meta: {
    marginTop: spacing.lg,
    color: colors.textMuted,
    fontSize: 13
  },
  updated: {
    marginTop: 5,
    color: colors.textFaint,
    fontSize: 12
  },
  actionButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    borderRadius: radii.control,
    borderWidth: 1
  },
  setButton: {
    borderColor: colors.accent,
    backgroundColor: colors.accent
  },
  removeButton: {
    borderColor: colors.border,
    backgroundColor: colors.controlMuted
  },
  setText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '700'
  },
  removeText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '700'
  },
  disabled: {
    opacity: 0.5
  },
  pressed: {
    opacity: 0.68
  }
})
