import { Pressable, StyleSheet, Text, View } from 'react-native'

import type { MobileUpdate } from '../types/api'
import { colors, radii, spacing } from '../theme'

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
          <Text style={styles.title}>{update.forceUpdate ? '需要更新' : '发现新版本'}</Text>
          <Text style={styles.version}>v{update.version}</Text>
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
        <Text style={styles.actionText}>{busy ? '正在打开' : '立即更新'}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.lg,
    padding: spacing.xl,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: '#f0dec2',
    backgroundColor: colors.warningSurface
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700'
  },
  version: {
    color: colors.warning,
    fontSize: 13,
    fontWeight: '600'
  },
  dismiss: {
    color: colors.textMuted,
    fontSize: 13
  },
  notes: {
    marginTop: spacing.md,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20
  },
  action: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    borderRadius: radii.control,
    backgroundColor: colors.accent
  },
  actionText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '700'
  },
  disabled: {
    opacity: 0.55
  },
  error: {
    marginTop: spacing.md,
    color: colors.danger,
    fontSize: 12
  },
  pressed: {
    opacity: 0.7
  }
})
