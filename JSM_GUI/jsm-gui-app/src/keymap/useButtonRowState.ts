import { useState } from 'react'
import { BindingSlot, ManualRowInfo, ManualRowState } from '../utils/keymap'

export const useButtonRowState = () => {
  const [manualRows, setManualRows] = useState<Record<string, ManualRowState>>({})
  const [stickShiftDisplayModes, setStickShiftDisplayModes] = useState<Record<string, 'tap' | 'extra'>>({})

  const ensureManualRow = (button: string, slot: BindingSlot, defaults?: ManualRowInfo) => {
    setManualRows(prev => {
      const existing = prev[button] ? { ...prev[button] } : {}
      if (existing[slot]) return prev
      existing[slot] = { ...(defaults ?? {}) }
      return { ...prev, [button]: existing }
    })
  }

  const updateManualRow = (button: string, slot: BindingSlot, info: ManualRowInfo) => {
    setManualRows(prev => {
      const existing = prev[button] ? { ...prev[button] } : {}
      existing[slot] = { ...(existing[slot] ?? {}), ...info }
      return { ...prev, [button]: existing }
    })
  }

  const removeManualRow = (button: string, slot: BindingSlot) => {
    setManualRows(prev => {
      const existing = prev[button]
      if (!existing || !existing[slot]) return prev
      const nextExisting = { ...existing }
      delete nextExisting[slot]
      const next = { ...prev }
      if (Object.keys(nextExisting).length === 0) {
        delete next[button]
      } else {
        next[button] = nextExisting
      }
      return next
    })
  }

  const updateStickShiftDisplayMode = (buttonKey: string, mode?: 'tap' | 'extra') => {
    setStickShiftDisplayModes(prev => {
      if (!mode) {
        if (!prev[buttonKey]) return prev
        const next = { ...prev }
        delete next[buttonKey]
        return next
      }
      if (prev[buttonKey] === mode) return prev
      return { ...prev, [buttonKey]: mode }
    })
  }

  const replaceStickShiftDisplayModes = (
    updater: (prev: Record<string, 'tap' | 'extra'>) => Record<string, 'tap' | 'extra'>
  ) => {
    setStickShiftDisplayModes(prev => updater(prev))
  }

  return {
    manualRows,
    ensureManualRow,
    updateManualRow,
    removeManualRow,
    stickShiftDisplayModes,
    updateStickShiftDisplayMode,
    replaceStickShiftDisplayModes,
  }
}
