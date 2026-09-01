import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, radii, spacing } from '../theme'

interface MonitorCardProps {
  threshold: number
  enabled: boolean
  busy?: boolean
  error?: string | null
  onThresholdChange: (threshold: number) => void
  onToggle: () => void
}

export function MonitorCard({
  threshold,
  enabled,
  busy = false,
  error = null,
  onThresholdChange,
  onToggle
}: MonitorCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>低电量提醒</Text>
        </View>
        <View style={[styles.status, enabled ? styles.statusOn : styles.statusOff]}>
          <View style={[styles.statusDot, enabled ? styles.statusDotOn : styles.statusDotOff]} />
          <Text style={[styles.statusText, enabled ? styles.statusTextOn : styles.statusTextOff]}>
            {enabled ? '已开启' : '未开启'}
          </Text>
        </View>
      </View>

      <View style={styles.thresholdRow}>
        <Text style={styles.thresholdLabel}>提醒阈值</Text>
        <View style={styles.stepper}>
          <Pressable
            onPress={() => onThresholdChange(threshold - 1)}
            disabled={busy || threshold <= 5}
            style={({ pressed }) => [styles.stepButton, pressed && styles.pressed, (busy || threshold <= 5) && styles.disabled]}
            accessibilityRole="button"
            accessibilityLabel="降低提醒阈值"
          >
            <Text style={styles.stepText}>−</Text>
          </Pressable>
          <Text style={styles.thresholdValue}>{threshold}度</Text>
          <Pressable
            onPress={() => onThresholdChange(threshold + 1)}
            disabled={busy || threshold >= 40}
            style={({ pressed }) => [styles.stepButton, pressed && styles.pressed, (busy || threshold >= 40) && styles.disabled]}
            accessibilityRole="button"
            accessibilityLabel="提高提醒阈值"
          >
            <Text style={styles.stepText}>＋</Text>
          </Pressable>
        </View>
      </View>

      <Pressable
        onPress={onToggle}
        disabled={busy}
        style={({ pressed }) => [styles.actionButton, enabled ? styles.actionButtonOff : styles.actionButtonOn, pressed && styles.pressed, busy && styles.disabled]}
        accessibilityRole="button"
        accessibilityLabel={enabled ? '关闭低电量提醒' : '开启低电量提醒'}
      >
        <Text style={[styles.actionText, enabled ? styles.actionTextOff : styles.actionTextOn]}>
          {busy ? '处理中' : enabled ? '关闭提醒' : '开启提醒'}
        </Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700'
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radii.pill
  },
  statusOn: {
    backgroundColor: colors.goodSurface
  },
  statusOff: {
    backgroundColor: colors.controlMuted
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: radii.pill
  },
  statusDotOn: {
    backgroundColor: colors.good
  },
  statusDotOff: {
    backgroundColor: colors.textFaint
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600'
  },
  statusTextOn: {
    color: colors.good
  },
  statusTextOff: {
    color: colors.textMuted
  },
  thresholdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl
  },
  thresholdLabel: {
    color: colors.textSecondary,
    fontSize: 14
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.control,
    backgroundColor: colors.controlMuted
  },
  stepButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center'
  },
  stepText: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '500'
  },
  thresholdValue: {
    minWidth: 54,
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center'
  },
  actionButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    borderRadius: radii.control,
    borderWidth: 1
  },
  actionButtonOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accent
  },
  actionButtonOff: {
    borderColor: colors.border,
    backgroundColor: colors.controlMuted
  },
  actionText: {
    fontSize: 15,
    fontWeight: '700'
  },
  actionTextOn: {
    color: colors.surface
  },
  actionTextOff: {
    color: colors.textSecondary
  },
  disabled: {
    opacity: 0.5
  },
  pressed: {
    opacity: 0.68
  },
  error: {
    marginTop: spacing.sm,
    color: colors.danger,
    fontSize: 12,
    textAlign: 'center'
  }
})
