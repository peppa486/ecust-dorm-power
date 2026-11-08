import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'

import { QueryCard } from './QueryCard'
import { colors, hairlineWidth, radii, spacing } from '../theme'
import type { BuildingOption, Campus } from '../types/api'

interface RoomSwitcherModalProps {
  visible: boolean
  campus: Campus
  building: BuildingOption | undefined
  room: string
  buildingsLoading: boolean
  buildingsError: string | null
  queryLoading: boolean
  disabled?: boolean
  onClose: () => void
  onCampusChange: (campus: Campus) => void
  onOpenBuildingPicker: () => void
  onRetryBuildings: () => void
  onRoomChange: (room: string) => void
  onQuery: () => void
}

export function RoomSwitcherModal({
  visible,
  campus,
  building,
  room,
  buildingsLoading,
  buildingsError,
  queryLoading,
  disabled = false,
  onClose,
  onCampusChange,
  onOpenBuildingPicker,
  onRetryBuildings,
  onRoomChange,
  onQuery
}: RoomSwitcherModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropDismiss} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text style={styles.title}>切换或查询寝室</Text>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="关闭寝室查询抽屉"
            >
              <Text style={styles.closeText}>完成</Text>
            </Pressable>
          </View>

          <QueryCard
            campus={campus}
            building={building}
            room={room}
            buildingsLoading={buildingsLoading}
            buildingsError={buildingsError}
            queryLoading={queryLoading}
            disabled={disabled}
            onCampusChange={onCampusChange}
            onOpenBuildingPicker={onOpenBuildingPicker}
            onRetryBuildings={onRetryBuildings}
            onRoomChange={onRoomChange}
            onQuery={onQuery}
          />
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.32)'
  },
  backdropDismiss: {
    flex: 1
  },
  sheet: {
    paddingTop: 10,
    paddingHorizontal: spacing.xl,
    paddingBottom: 28,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    backgroundColor: colors.background
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(60, 60, 67, 0.24)',
    marginBottom: spacing.md
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: hairlineWidth,
    borderBottomColor: colors.separator
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.4
  },
  closeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.controlMuted
  },
  closeText: {
    color: colors.iosBlue,
    fontSize: 13,
    fontWeight: '600'
  },
  pressed: {
    opacity: 0.68
  }
})
