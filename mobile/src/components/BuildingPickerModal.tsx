import { ActivityIndicator, FlatList, Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native'

import type { BuildingOption, Campus } from '../types/api'
import { colors, radii, spacing } from '../theme'

interface BuildingPickerModalProps {
  visible: boolean
  campus: Campus
  buildings: BuildingOption[]
  selectedValue: string
  loading: boolean
  error: string | null
  onClose: () => void
  onSelect: (building: BuildingOption) => void
  onRetry: () => void
}

export function BuildingPickerModal({
  visible,
  campus,
  buildings,
  selectedValue,
  loading,
  error,
  onClose,
  onSelect,
  onRetry
}: BuildingPickerModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="关闭楼栋选择" />
        <View style={styles.sheet}>
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>选择楼栋</Text>
                <Text style={styles.subtitle}>{campus}校区</Text>
              </View>
              <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="关闭">
                <Text style={styles.close}>关闭</Text>
              </Pressable>
            </View>

            {loading ? (
              <View style={styles.stateBox}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.stateText}>正在加载楼栋…</Text>
              </View>
            ) : error ? (
              <View style={styles.stateBox}>
                <Text style={styles.stateText}>{error}</Text>
                <Pressable onPress={onRetry} style={styles.retryButton} accessibilityRole="button">
                  <Text style={styles.retryText}>重新加载</Text>
                </Pressable>
              </View>
            ) : (
              <FlatList
                data={buildings}
                keyExtractor={item => item.value}
                style={styles.list}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => {
                  const selected = item.value === selectedValue
                  return (
                    <Pressable
                      onPress={() => onSelect(item)}
                      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={item.label}
                    >
                      <Text style={[styles.rowLabel, selected && styles.rowLabelSelected]}>{item.label}</Text>
                      {selected ? <Text style={styles.check}>✓</Text> : null}
                    </Pressable>
                  )
                }}
                ListEmptyComponent={
                  <View style={styles.stateBox}>
                    <Text style={styles.stateText}>暂无可选楼栋</Text>
                  </View>
                }
              />
            )}
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(18, 21, 26, 0.34)'
  },
  sheet: {
    height: '82%',
    minHeight: '42%',
    maxHeight: '82%',
    borderTopLeftRadius: radii.card + 4,
    borderTopRightRadius: radii.card + 4,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xxl
  },
  safeArea: {
    flex: 1
  },
  handle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    marginTop: 10,
    borderRadius: 4,
    backgroundColor: colors.controlMuted
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700'
  },
  subtitle: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 13
  },
  close: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '600'
  },
  listContent: {
    paddingBottom: spacing.xxl + 28
  },
  list: {
    flex: 1
  },
  row: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderRadius: radii.control,
    marginBottom: 6,
    backgroundColor: colors.control
  },
  pressed: {
    opacity: 0.68
  },
  rowLabel: {
    color: colors.textSecondary,
    fontSize: 16
  },
  rowLabelSelected: {
    color: colors.text,
    fontWeight: '700'
  },
  check: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: '700'
  },
  stateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 170,
    paddingBottom: 24
  },
  stateText: {
    marginTop: 12,
    color: colors.textMuted,
    fontSize: 15,
    textAlign: 'center'
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.controlMuted
  },
  retryText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600'
  }
})
