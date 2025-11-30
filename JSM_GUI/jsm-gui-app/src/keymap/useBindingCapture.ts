import { useEffect, useState } from 'react'
import { BindingSlot } from '../utils/keymap'
import { keyboardEventToBinding, mouseButtonToBinding, shouldIgnoreCapture, wheelEventToBinding } from './bindings'

type CaptureTarget = { button: string; slot: BindingSlot; modifier?: string }

export const useBindingCapture = (
  onBindingChange: (button: string, slot: BindingSlot, value: string | null, options?: { modifier?: string }) => void
) => {
  const [captureTarget, setCaptureTarget] = useState<CaptureTarget | null>(null)
  const [captureLabel, setCaptureLabel] = useState<string>('')
  const [suppressKey, setSuppressKey] = useState<string | null>(null)

  useEffect(() => {
    if (!captureTarget) return
    const handleBinding = (value: string | null, suppress: boolean) => {
      if (value) {
        onBindingChange(captureTarget.button, captureTarget.slot, value, { modifier: captureTarget.modifier })
        if (suppress) {
          setSuppressKey(`${captureTarget.button}-${captureTarget.slot}`)
        } else {
          setSuppressKey(null)
        }
        setCaptureTarget(null)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreCapture(event)) return
      event.preventDefault()
      event.stopPropagation()
      const binding = keyboardEventToBinding(event)
      handleBinding(binding, false)
    }

    const handleMouseDown = (event: MouseEvent) => {
      if (shouldIgnoreCapture(event)) return
      event.preventDefault()
      event.stopPropagation()
      const binding = mouseButtonToBinding(event.button)
      handleBinding(binding, true)
    }

    const handleWheel = (event: WheelEvent) => {
      if (shouldIgnoreCapture(event)) return
      event.preventDefault()
      event.stopPropagation()
      const binding = wheelEventToBinding(event.deltaY)
      handleBinding(binding, false)
    }

    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('mousedown', handleMouseDown, true)
    const wheelListenerOptions: AddEventListenerOptions = { passive: false, capture: true }
    window.addEventListener('wheel', handleWheel, wheelListenerOptions)

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('mousedown', handleMouseDown, true)
      window.removeEventListener('wheel', handleWheel, wheelListenerOptions)
    }
  }, [captureTarget, onBindingChange])

  const beginCapture = (button: string, slot: BindingSlot, label: string, modifier?: string) => {
    const key = `${button}-${slot}`
    if (suppressKey === key) {
      setSuppressKey(null)
      return
    }
    setCaptureLabel(label)
    setCaptureTarget({ button, slot, modifier })
  }

  const cancelCapture = () => {
    setCaptureTarget(null)
    setSuppressKey(null)
  }

  const isCapturing = (button: string, slot: BindingSlot) =>
    captureTarget?.button === button && captureTarget.slot === slot

  return {
    captureLabel,
    beginCapture,
    cancelCapture,
    isCapturing,
  }
}
