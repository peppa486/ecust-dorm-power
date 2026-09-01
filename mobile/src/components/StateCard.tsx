import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, radii, spacing } from '../theme'

interface StateCardProps {
  kind: 'empty' | 'error' | 'loading'
  title: string
  message: string
  onRetry?: () => void
}

export function StateCard({ kind, title, message, onRetry }: StateCardProps) {
  return (
    <View style={[styles.card, kind === 'error' && styles.errorCard]}>
      {kind === 'loading' ? <ActivityIndicator color={colors.accent} /> : null}
      <Text style={[styles.title, kind === 'error' && styles.errorTitle]}>{title}</Text>
      <Text style={[styles.message, kind === 'loading' && styles.loadingMessage]}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} style={({ pressed }) => [styles.retry, pressed && styles.pressed]} accessibilityRole="button">
          <Text style={styles.retryText}>重新查询</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: 25,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  errorCard: {
    backgroundColor: '#fffafa',
    borderColor: '#f4d8d5'
  },
  title: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '600'
  },
  errorTitle: {
    color: colors.danger
  },
  message: {
    marginTop: 7,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center'
  },
  loadingMessage: {
    marginTop: 9
  },
  retry: {
    marginTop: spacing.md,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 11,
    backgroundColor: colors.controlMuted
  },
  retryText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600'
  },
  pressed: {
    opacity: 0.68
  }
})
