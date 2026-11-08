import { Pressable, StyleSheet, Text, View } from 'react-native'

import { cardShadow, colors, hairlineWidth, radii, spacing } from '../theme'

interface MonitorCardProps {
  threshold: number
  enabled: boolean
  ongoingEnabled: boolean
  thresholdEtaLabel?: string
  lastCheckedAt?: string | null
  busy?: boolean
  testingNotification?: boolean
  feedbackMessage?: string | null
  error?: string | null
  onThresholdChange: (threshold: number) => void
  onToggle: () => void
  onToggleOngoing: () => void
  onTestNotification: () => void
  onOpenBatterySettings: () => void
}

function IosSwitch({
  value,
  disabled,
  onPress,
  label
}: {
  value: boolean
  disabled?: boolean
  onPress: () => void
  label: string
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.switchTrack,
        value ? styles.switchTrackOn : styles.switchTrackOff,
        disabled && styles.disabled
      ]}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={label}
    >
      <View
        style={[
          styles.switchThumb,
          value ? styles.switchThumbOn : styles.switchThumbOff
        ]}
      />
    </Pressable>
  )
}

export function MonitorCard({
  threshold,
  enabled,
  ongoingEnabled,
  busy = false,
  testingNotification = false,
  feedbackMessage = null,
  error = null,
  onThresholdChange,
  onToggle,
  onToggleOngoing,
  onTestNotification,
  onOpenBatterySettings
}: MonitorCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>电量提醒</Text>
        <View style={[styles.statusPill, enabled ? styles.statusOn : styles.statusOff]}>
          <View style={[styles.statusDot, enabled ? styles.statusDotOn : styles.statusDotOff]} />
          <Text style={[styles.statusText, enabled ? styles.statusTextOn : styles.statusTextOff]}>
            {enabled ? '已开启' : '未开启'}
          </Text>
        </View>
      </View>

      <View style={styles.listRow}>
        <Text style={styles.rowTitle}>低电量通知</Text>
        <IosSwitch
          value={enabled}
          disabled={busy}
          onPress={onToggle}
          label={enabled ? '关闭低电量提醒' : '开启低电量提醒'}
        />
      </View>

      <View style={styles.listRow}>
        <Text style={styles.rowTitle}>提醒阈值</Text>
        <View style={styles.stepper}>
          <Pressable
            onPress={() => onThresholdChange(threshold - 1)}
            disabled={busy || threshold <= 5}
            style={({ pressed }) => [
              styles.stepButton,
              pressed && styles.pressed,
              (busy || threshold <= 5) && styles.disabled
            ]}
            accessibilityRole="button"
            accessibilityLabel="降低提醒阈值"
          >
            <Text style={styles.stepText}>−</Text>
          </Pressable>
          <Text style={styles.thresholdValue}>{threshold} 度</Text>
          <Pressable
            onPress={() => onThresholdChange(threshold + 1)}
            disabled={busy || threshold >= 40}
            style={({ pressed }) => [
              styles.stepButton,
              pressed && styles.pressed,
              (busy || threshold >= 40) && styles.disabled
            ]}
            accessibilityRole="button"
            accessibilityLabel="提高提醒阈值"
          >
            <Text style={styles.stepText}>＋</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.listRow}>
        <Text style={styles.rowTitle}>通知栏常驻电量</Text>
        <IosSwitch
          value={enabled && ongoingEnabled}
          disabled={busy || !enabled}
          onPress={onToggleOngoing}
          label="切换通知栏常驻电量"
        />
      </View>

      <Pressable
        onPress={onOpenBatterySettings}
        style={({ pressed }) => [styles.listRow, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="后台省电白名单"
      >
        <Text style={styles.rowTitle}>后台省电白名单</Text>
        <Text style={styles.actionLinkText}>设置 ›</Text>
      </Pressable>

      <Pressable
        onPress={onTestNotification}
        disabled={testingNotification}
        style={({ pressed }) => [
          styles.listRow,
          styles.lastRow,
          pressed && styles.pressed,
          testingNotification && styles.disabled
        ]}
        accessibilityRole="button"
        accessibilityLabel="发送测试通知"
      >
        <Text style={styles.rowTitle}>测试通知</Text>
        <Text style={styles.actionLinkText}>
          {testingNotification ? '发送中…' : '发送 ›'}
        </Text>
      </Pressable>

      {feedbackMessage ? <Text style={styles.feedbackText}>{feedbackMessage}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    ...cardShadow
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
    borderBottomWidth: hairlineWidth,
    borderBottomColor: colors.separator
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.pill
  },
  statusOn: {
    backgroundColor: colors.iosGreenSurface
  },
  statusOff: {
    backgroundColor: colors.control
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: radii.pill
  },
  statusDotOn: {
    backgroundColor: colors.iosGreen
  },
  statusDotOff: {
    backgroundColor: colors.textFaint
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600'
  },
  statusTextOn: {
    color: colors.iosGreenDark
  },
  statusTextOff: {
    color: colors.textMuted
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 46,
    paddingVertical: 8,
    borderBottomWidth: hairlineWidth,
    borderBottomColor: colors.separator,
    gap: spacing.md
  },
  lastRow: {
    borderBottomWidth: 0
  },
  rowTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '500'
  },
  switchTrack: {
    width: 48,
    height: 28,
    borderRadius: radii.pill,
    padding: 2,
    justifyContent: 'center'
  },
  switchTrackOn: {
    backgroundColor: colors.iosGreen
  },
  switchTrackOff: {
    backgroundColor: 'rgba(120, 120, 128, 0.24)'
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 2.5,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2
  },
  switchThumbOn: {
    alignSelf: 'flex-end'
  },
  switchThumbOff: {
    alignSelf: 'flex-start'
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 9,
    backgroundColor: colors.control
  },
  stepButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center'
  },
  stepText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '500'
  },
  thresholdValue: {
    minWidth: 46,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    fontVariant: ['tabular-nums']
  },
  actionLinkText: {
    color: colors.iosBlue,
    fontSize: 14,
    fontWeight: '500'
  },
  feedbackText: {
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    color: colors.iosGreenDark,
    fontSize: 12,
    textAlign: 'center'
  },
  errorText: {
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    color: colors.iosRed,
    fontSize: 12,
    textAlign: 'center'
  },
  disabled: {
    opacity: 0.45
  },
  pressed: {
    opacity: 0.68
  }
})
