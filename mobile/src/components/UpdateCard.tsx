import { Pressable, StyleSheet, Text, View } from 'react-native'

import type { MobileUpdate } from '../types/api'
import { cardShadow, colors, hairlineWidth, radii, spacing } from '../theme'

interface UpdateCardProps {
  update: MobileUpdate
  busy?: boolean
  error?: string | null
  onInstall: () => void
  onDismiss: () => void
}

export function UpdateCard({ update, busy = false, error = null, onInstall, onDismiss }: UpdateCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleGroup}>
          <Text style={styles.title}>{update.forceUpdate ? '需要更新版本' : '发现新版本'}</Text>
          <View style={styles.versionPill}>
            <Text style={styles.version}>v{update.version}</Text>
          </View>
        </View>
        {!update.forceUpdate ? (
          <Pressable onPress={onDismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel="稍后更新">
            <Text style={styles.dismiss}>稍后</Text>
          </Pressable>
        ) : null}
      </View>

      {update.releaseNotes ? <Text style={styles.notes}>{update.releaseNotes}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        onPress={onInstall}
        disabled={busy}
        style={({ pressed }) => [styles.action, pressed && styles.pressed, busy && styles.disabled]}
        accessibilityRole="button"
        accessibilityLabel="立即更新"
      >
        <Text style={styles.actionText}>{busy ? '正在打开下载...' : '立即更新'}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.card,
    borderWidth: hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...cardShadow
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700'
  },
  versionPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.iosBlueSurface
  },
  version: {
    color: colors.iosBlue,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums']
  },
  dismiss: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '500'
  },
  notes: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19
  },
  action: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    borderRadius: radii.control,
    backgroundColor: colors.accent
  },
  actionText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '600'
  },
  disabled: {
    opacity: 0.55
  },
  error: {
    marginTop: spacing.sm,
    color: colors.danger,
    fontSize: 12
  },
  pressed: {
    opacity: 0.72
  }
})
