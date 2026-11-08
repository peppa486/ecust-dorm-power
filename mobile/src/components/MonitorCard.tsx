import { Pressable, StyleSheet, Text, View } from 'react-native'

import { cardShadow, colors, hairlineWidth, radii, spacing } from '../theme'
import { formatUpdatedAt } from '../utils/power'

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
  thresholdEtaLabel,
  lastCheckedAt,
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
  const formattedLastCheck = lastCheckedAt ? formatUpdatedAt(lastCheckedAt) : ''

  return (
    <View style={styles.card}>
      {/* 卡片顶部标题与运行状态胶囊 */}
      <View style={styles.header}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>通知与后台守护</Text>
          <Text style={styles.subtitle}>
            {formattedLastCheck
              ? `上次巡检于 ${formattedLastCheck}`
              : '结合本地定时巡检、系统级预测闹钟与常驻通知栏三重守护'}
          </Text>
        </View>
        <View style={[styles.statusPill, enabled ? styles.statusOn : styles.statusOff]}>
          <View style={[styles.statusDot, enabled ? styles.statusDotOn : styles.statusDotOff]} />
          <Text style={[styles.statusText, enabled ? styles.statusTextOn : styles.statusTextOff]}>
            {enabled ? '守护中' : '未开启'}
          </Text>
        </View>
      </View>

      {/* 行 1：低电量提醒主开关 */}
      <View style={styles.listRow}>
        <View style={styles.rowTextBlock}>
          <Text style={styles.rowTitle}>低电量通知提醒</Text>
          <Text style={styles.rowDesc}>
            低于 {threshold} 度时立即弹窗提醒，并注册系统预测闹钟
          </Text>
        </View>
        <IosSwitch
          value={enabled}
          disabled={busy}
          onPress={onToggle}
          label={enabled ? '关闭低电量提醒' : '开启低电量提醒'}
        />
      </View>

      {/* 行 2：提醒阈值步进调节 */}
      <View style={styles.listRow}>
        <View style={styles.rowTextBlock}>
          <Text style={styles.rowTitle}>预警阈值</Text>
          <Text style={styles.rowDesc}>{thresholdEtaLabel || '可设置 5 – 40 度'}</Text>
        </View>
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

      {/* 行 3：常驻通知栏电量卡片开关 */}
      <View style={styles.listRow}>
        <View style={styles.rowTextBlock}>
          <Text style={styles.rowTitle}>常驻通知栏电量卡片</Text>
          <Text style={styles.rowDesc}>
            下拉通知栏实时查看度数，防止系统清理后台进程
          </Text>
        </View>
        <IosSwitch
          value={enabled && ongoingEnabled}
          disabled={busy || !enabled}
          onPress={onToggleOngoing}
          label="切换常驻通知栏电量卡片"
        />
      </View>

      {/* 行 4：后台电池优化白名单 */}
      <Pressable
        onPress={onOpenBatterySettings}
        style={({ pressed }) => [styles.listRow, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="打开系统电池优化白名单设置"
      >
        <View style={styles.rowTextBlock}>
          <Text style={styles.rowTitle}>后台无限制运行权限</Text>
          <Text style={styles.rowDesc}>
            建议在系统电池设置中设为「无限制 / 忽略电池优化」
          </Text>
        </View>
        <Text style={styles.actionLinkText}>去设置 ›</Text>
      </Pressable>

      {/* 行 5：立即发送测试通知 */}
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
        accessibilityLabel="立即发送测试通知"
      >
        <View style={styles.rowTextBlock}>
          <Text style={styles.rowTitle}>通知通道自检</Text>
          <Text style={styles.rowDesc}>
            发送一条立即弹窗的测试通知以验证权限是否生效
          </Text>
        </View>
        <Text style={styles.actionLinkText}>
          {testingNotification ? '发送中…' : '立即测试 ›'}
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
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    ...cardShadow
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: hairlineWidth,
    borderBottomColor: colors.separator
  },
  headerTextWrap: {
    flex: 1,
    flexShrink: 1
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3
  },
  subtitle: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 11
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
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
    paddingVertical: 13,
    borderBottomWidth: hairlineWidth,
    borderBottomColor: colors.separator,
    gap: spacing.md
  },
  lastRow: {
    borderBottomWidth: 0,
    paddingBottom: 6
  },
  rowTextBlock: {
    flex: 1
  },
  rowTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600'
  },
  rowDesc: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 11,
    fontVariant: ['tabular-nums']
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
    borderRadius: 10,
    backgroundColor: colors.control
  },
  stepButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center'
  },
  stepText: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '500'
  },
  thresholdValue: {
    minWidth: 50,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    fontVariant: ['tabular-nums']
  },
  actionLinkText: {
    color: colors.iosBlue,
    fontSize: 13,
    fontWeight: '600'
  },
  feedbackText: {
    marginTop: spacing.sm,
    color: colors.iosGreenDark,
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500'
  },
  errorText: {
    marginTop: spacing.sm,
    color: colors.iosRed,
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500'
  },
  disabled: {
    opacity: 0.45
  },
  pressed: {
    opacity: 0.68
  }
})
