import { useEffect, useState } from 'react'

export type TelemetrySample = {
  omega?: number
  t?: number
  u?: number
  sensX?: number
  sensY?: number
  curve?: string
  devices?: {
    handle: number
    type: number
    split?: number
    vid?: number
    pid?: number
  }[]
  [key: string]: unknown
}

export function useTelemetry() {
  const [sample, setSample] = useState<TelemetrySample | null>(null)
  const [isCalibrating, setIsCalibrating] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)

  useEffect(() => {
    const dispose = window.telemetry?.onSample?.((payload) => {
      setSample(payload as TelemetrySample)
    })
    const statusDispose = window.electronAPI?.onCalibrationStatus?.((state: { calibrating: boolean; seconds?: number }) => {
      setIsCalibrating(state.calibrating)
      if (state.calibrating && state.seconds)
        setCountdown(state.seconds)
      else
        setCountdown(null)
    })
    return () => {
      dispose?.()
      statusDispose?.()
    }
  }, [])

  return { sample, isCalibrating, countdown }
}
