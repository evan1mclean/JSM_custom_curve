import { useMemo } from 'react'
import {
  BindingSlot,
  getKeymapValue,
  isTrackballBindingPresent,
  removeKeymapEntry,
  setChordBinding,
  setDoubleBinding,
  setHoldBinding,
  setSimultaneousBinding,
  setTapBinding,
  updateKeymapEntry,
} from '../utils/keymap'

const TOGGLE_SPECIALS = ['GYRO_ON', 'GYRO_OFF'] as const
const SPECIAL_COMMANDS = [
  'GYRO_OFF',
  'GYRO_ON',
  'GYRO_INVERT',
  'GYRO_INV_X',
  'GYRO_INV_Y',
  'GYRO_TRACKBALL',
  'GYRO_TRACK_X',
  'GYRO_TRACK_Y',
]

const clearToggleAssignments = (text: string, command: string) => {
  let next = text
  TOGGLE_SPECIALS.forEach(toggle => {
    const assigned = getKeymapValue(next, toggle)
    if (assigned) {
      const matches = assigned
        .split(/\s+/)
        .filter(Boolean)
        .some(token => token.toUpperCase() === command.toUpperCase())
      if (matches) {
        next = removeKeymapEntry(next, toggle)
      }
    }
  })
  return next
}

const removeTrackballDecayIfUnused = (text: string) => {
  return isTrackballBindingPresent(text) ? text : removeKeymapEntry(text, 'TRACKBALL_DECAY')
}

const clearSpecialAssignmentsForButton = (text: string, button: string) => {
  let next = text
  SPECIAL_COMMANDS.forEach(cmd => {
    const assignment = getKeymapValue(next, cmd)
    if (!assignment) return
    const tokens = assignment.split(/\s+/).filter(Boolean)
    const remaining = tokens.filter(token => token.toUpperCase() !== button.toUpperCase())
    if (remaining.length === tokens.length) {
      return
    }
    if (remaining.length === 0) {
      next = removeKeymapEntry(next, cmd)
    } else {
      next = updateKeymapEntry(next, cmd, remaining)
    }
  })
  return next
}

type BindingArgs = {
  configText: string
  setConfigText: React.Dispatch<React.SetStateAction<string>>
}

export function useBindingsConfig({ configText, setConfigText }: BindingArgs) {
  const handleFaceButtonBindingChange = (
    button: string,
    slot: BindingSlot,
    binding: string | null,
    options?: { modifier?: string }
  ) => {
    setConfigText(prev => {
      let next = clearSpecialAssignmentsForButton(prev, button)
      next = clearToggleAssignments(next, button)
      switch (slot) {
        case 'tap':
          next = setTapBinding(next, button, binding)
          break
        case 'hold':
          next = setHoldBinding(next, button, binding)
          break
        case 'double':
          next = setDoubleBinding(next, button, binding)
          break
        case 'chord':
          next = setChordBinding(next, button, options?.modifier, binding)
          break
        case 'simultaneous':
          next = setSimultaneousBinding(next, button, options?.modifier, binding)
          break
        default:
          break
      }
      return removeTrackballDecayIfUnused(next)
    })
  }

  const handleModifierChange = (
    button: string,
    slot: BindingSlot,
    previousModifier: string | undefined,
    nextModifier: string,
    binding: string | null
  ) => {
    if (!nextModifier || previousModifier === nextModifier) return
    setConfigText(prev => {
      let next = prev
      if (slot === 'chord') {
        if (previousModifier) {
          next = setChordBinding(next, button, previousModifier, null)
        }
        if (binding) {
          next = setChordBinding(next, button, nextModifier, binding)
        }
      } else if (slot === 'simultaneous') {
        if (previousModifier) {
          next = setSimultaneousBinding(next, button, previousModifier, null)
        }
        if (binding) {
          next = setSimultaneousBinding(next, button, nextModifier, binding)
        }
      }
      return next
    })
  }

  const handleSpecialActionAssignment = (specialCommand: string, buttonCommand: string) => {
    setConfigText(prev => {
      let next = clearSpecialAssignmentsForButton(prev, buttonCommand)
      next = removeKeymapEntry(next, buttonCommand)
      next = clearToggleAssignments(next, buttonCommand)
      if (TOGGLE_SPECIALS.includes(specialCommand as (typeof TOGGLE_SPECIALS)[number])) {
        return removeTrackballDecayIfUnused(updateKeymapEntry(next, specialCommand, [buttonCommand]))
      }
      next = updateKeymapEntry(next, buttonCommand, [specialCommand])
      return removeTrackballDecayIfUnused(next)
    })
  }

  const handleClearSpecialAction = (specialCommand: string, buttonCommand: string) => {
    setConfigText(prev => {
      const assignment = getKeymapValue(prev, specialCommand)
      if (assignment) {
        const matches = assignment
          .split(/\s+/)
          .filter(Boolean)
          .some(token => token.toUpperCase() === buttonCommand.toUpperCase())
        if (matches) {
          const updated = removeKeymapEntry(prev, specialCommand)
          return removeTrackballDecayIfUnused(updated)
        }
      }
      return prev
    })
  }

  const handleTrackballDecayChange = (value: string) => {
    const nextValue = value.trim()
    setConfigText(prev => {
      if (!nextValue) {
        return removeKeymapEntry(prev, 'TRACKBALL_DECAY')
      }
      const numeric = Number(nextValue)
      if (Number.isNaN(numeric)) {
        return prev
      }
      return updateKeymapEntry(prev, 'TRACKBALL_DECAY', [numeric])
    })
  }

  const trackballDecayValue = useMemo(() => getKeymapValue(configText, 'TRACKBALL_DECAY') ?? '', [configText])

  return {
    handleFaceButtonBindingChange,
    handleModifierChange,
    handleSpecialActionAssignment,
    handleClearSpecialAction,
    handleTrackballDecayChange,
    trackballDecayValue,
  }
}
