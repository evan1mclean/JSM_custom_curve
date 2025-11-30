import { useCallback, useMemo } from 'react'
import { getKeymapValue, removeKeymapEntry, updateKeymapEntry } from '../utils/keymap'

type TouchpadArgs = {
  configText: string
  setConfigText: React.Dispatch<React.SetStateAction<string>>
}

export function useTouchpadConfig({ configText, setConfigText }: TouchpadArgs) {
  const touchpadModeValue = (getKeymapValue(configText, 'TOUCHPAD_MODE') ?? '').toUpperCase()
  const gridSizeRaw = useMemo(() => getKeymapValue(configText, 'GRID_SIZE'), [configText])
  const gridSizeValue = useMemo(() => {
    if (gridSizeRaw) {
      const tokens = gridSizeRaw.split(/\s+/).map(token => Number(token))
      const cols = Number.isFinite(tokens[0]) ? tokens[0] : 2
      const rows = Number.isFinite(tokens[1]) ? tokens[1] : 1
      return { columns: cols, rows: rows }
    }
    return { columns: 2, rows: 1 }
  }, [gridSizeRaw])

  const touchpadSensitivityValue = useMemo(() => {
    const raw = getKeymapValue(configText, 'TOUCHPAD_SENS')
    if (!raw) return undefined
    const parsed = parseFloat(raw)
    return Number.isFinite(parsed) ? parsed : undefined
  }, [configText])

  const handleTouchpadModeChange = useCallback(
    (value: string) => {
      const upper = value?.toUpperCase() ?? ''
      setConfigText(prev => {
        let next = prev
        if (upper === '') {
          next = removeKeymapEntry(next, 'TOUCHPAD_MODE')
          return next
        }
        const sanitized = upper === 'MOUSE' ? 'MOUSE' : 'GRID_AND_STICK'
        next = updateKeymapEntry(next, 'TOUCHPAD_MODE', [sanitized])
        if (sanitized === 'GRID_AND_STICK' && !gridSizeRaw) {
          next = updateKeymapEntry(next, 'GRID_SIZE', [gridSizeValue.columns, gridSizeValue.rows])
        }
        return next
      })
    },
    [gridSizeRaw, gridSizeValue.columns, gridSizeValue.rows, setConfigText]
  )

  const handleGridSizeChange = useCallback((columns: number, rows: number) => {
    const cols = Math.max(1, Math.min(5, Math.round(columns)))
    const rws = Math.max(1, Math.min(5, Math.round(rows)))
    setConfigText(prev => updateKeymapEntry(prev, 'GRID_SIZE', [cols, rws]))
  }, [setConfigText])

  const handleTouchpadSensitivityChange = useCallback((value: string) => {
    if (value === '') {
      setConfigText(prev => removeKeymapEntry(prev, 'TOUCHPAD_SENS'))
      return
    }
    const parsed = parseFloat(value)
    if (Number.isNaN(parsed)) return
    setConfigText(prev => updateKeymapEntry(prev, 'TOUCHPAD_SENS', [parsed]))
  }, [setConfigText])

  return {
    touchpadModeValue,
    gridSizeValue,
    touchpadSensitivityValue,
    handleTouchpadModeChange,
    handleGridSizeChange,
    handleTouchpadSensitivityChange,
  }
}
