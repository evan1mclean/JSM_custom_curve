import { useEffect, useRef } from 'react'

interface SensitivityGraphProps {
  minThreshold?: number
  maxThreshold?: number
  minSensX?: number
  maxSensX?: number
  minSensY?: number
  maxSensY?: number
  curveType?: 'LINEAR' | 'NATURAL' | 'POWER'
  naturalVHalf?: number
  powerVRef?: number
  powerExponent?: number
  normalized?: number
  currentSensX?: number
  omega?: number
  disableLiveDot?: boolean
}

const MAX_OMEGA = 500

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)
const LIVE_SENS_COLOR = '#6a8bff'
const LIVE_OUTPUT_COLOR = '#52c1ff'

export function SensitivityGraph(props: SensitivityGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const {
    minThreshold,
    maxThreshold,
    minSensX,
  maxSensX,
  minSensY,
  maxSensY,
  curveType = 'LINEAR',
  naturalVHalf,
  powerVRef,
  powerExponent,
  normalized,
  currentSensX,
  omega,
  disableLiveDot,
} = props

  useEffect(() => {

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const ratio = window.devicePixelRatio || 1
    const baseWidth = 800
    const baseHeight = 420
    canvas.width = baseWidth * ratio
    canvas.height = baseHeight * ratio
    canvas.style.width = '100%'
    canvas.style.height = `${(baseHeight / baseWidth) * 100}%`
    ctx.resetTransform()
    ctx.scale(ratio, ratio)

    ctx.fillStyle = '#0f0f0f'
    ctx.fillRect(0, 0, baseWidth, baseHeight)
    ctx.strokeStyle = '#2d2d2d'
    ctx.lineWidth = 2
    ctx.strokeRect(0, 0, baseWidth, baseHeight)

    const isNatural = curveType === 'NATURAL'
    const isPower = curveType === 'POWER'

    const hasLinearInputs =
      minThreshold !== undefined && maxThreshold !== undefined && minSensX !== undefined && maxSensX !== undefined
    const hasNaturalInputs =
      minThreshold !== undefined && minSensX !== undefined && maxSensX !== undefined && naturalVHalf !== undefined && naturalVHalf > 0
    const hasPowerInputs =
      minThreshold !== undefined &&
      minSensX !== undefined &&
      maxSensX !== undefined &&
      powerVRef !== undefined &&
      powerVRef > 0 &&
      powerExponent !== undefined &&
      powerExponent > 0

    if ((isNatural && !hasNaturalInputs) || (isPower && !hasPowerInputs) || (!isNatural && !isPower && !hasLinearInputs)) {
      ctx.fillStyle = '#777'
      ctx.font = '16px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Provide required sensitivity + curve inputs to preview.', baseWidth / 2, baseHeight / 2)
      return
    }

    const paddingLeft = 55
    const paddingRight = 25
    const paddingTop = 25
    const paddingBottom = 60
    const graphWidth = baseWidth - paddingLeft - paddingRight
    const graphHeight = baseHeight - paddingTop - paddingBottom

    ctx.fillStyle = '#ddd'
    ctx.font = '14px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Threshold (°/s)', paddingLeft + graphWidth / 2, baseHeight - 10)
    ctx.save()
    ctx.translate(18, paddingTop + graphHeight / 2 + 20)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText('RWS', 0, 0)
    ctx.restore()

    const axisMaxX = Math.max(MAX_OMEGA, maxThreshold ?? 0, powerVRef ?? 0)
    const axisMaxY = Math.max(minSensX, maxSensX, 2)

    const toX = (speed: number) => paddingLeft + (graphWidth * (speed / axisMaxX))
    const toY = (sens: number) => paddingTop + graphHeight - (graphHeight * (sens / axisMaxY))

    ctx.strokeStyle = '#3b3b3b'
    ctx.lineWidth = 1
    ctx.font = '12px sans-serif'
    ctx.fillStyle = '#aaa'
    ctx.textAlign = 'right'
    for (let i = 0; i <= 6; i++) {
      const value = (axisMaxY / 6) * i
      const y = paddingTop + graphHeight - (graphHeight / 6) * i
      ctx.beginPath()
      ctx.moveTo(paddingLeft, y)
      ctx.lineTo(baseWidth - paddingRight, y)
      ctx.stroke()
      ctx.fillText(value.toFixed(2), paddingLeft - 10, y + 4)
    }
    ctx.textAlign = 'center'
    for (let i = 0; i <= 10; i++) {
      const value = (axisMaxX / 10) * i
      const x = paddingLeft + (graphWidth / 10) * i
      ctx.beginPath()
      ctx.moveTo(x, paddingTop)
      ctx.lineTo(x, paddingTop + graphHeight)
      ctx.stroke()
      ctx.fillText(value.toFixed(0), x, paddingTop + graphHeight + 30)
    }

    const naturalSensitivityAt = (speed: number) => {
      const vHalf = naturalVHalf ?? 0
      const omegaAdjusted = Math.max(0, speed - (minThreshold ?? 0))
      const delta = maxSensX - minSensX
      const k = Math.log(2) / vHalf
      return maxSensX - delta * Math.exp(-k * omegaAdjusted)
    }

    const powerSensitivityAt = (speed: number) => {
      const vRef = powerVRef ?? 0
      const exponent = powerExponent ?? 0
      const omegaAdjusted = Math.max(0, speed - (minThreshold ?? 0))
      if (vRef <= 0 || exponent <= 0 || omegaAdjusted <= 0) return minSensX
      const x = omegaAdjusted / vRef
      const u = Math.pow(x, exponent)
      const t = clamp(1 - Math.exp(-u), 0, 1)
      return minSensX + (maxSensX - minSensX) * t
    }

    const sensitivityAt = (speed: number) => {
      if (isNatural) {
        return naturalSensitivityAt(speed)
      }
      if (isPower) {
        return powerSensitivityAt(speed)
      }
      const denom = (maxThreshold ?? 0) - (minThreshold ?? 0)
      if (denom <= 0) {
        return speed > (minThreshold ?? 0) ? maxSensX : minSensX
      }
      const progress = clamp((speed - (minThreshold ?? 0)) / denom, 0, 1)
      return minSensX + progress * (maxSensX - minSensX)
    }

    const drawSensitivityCurve = () => {
      ctx.strokeStyle = '#6a8bff'
      ctx.lineWidth = 2.2
      ctx.beginPath()
      const points = 250
      const speeds = Array.from({ length: points }, (_, i) => (axisMaxX / (points - 1)) * i)
      speeds.forEach((speed, idx) => {
        const sens = sensitivityAt(speed)
        const x = toX(speed)
        const y = toY(sens)
        if (idx === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()
    }

    drawSensitivityCurve()

    const drawVelocityCurve = () => {
      const points = 250
      const speeds = Array.from({ length: points }, (_, i) => (axisMaxX / (points - 1)) * i)
      const outputs = speeds.map(speed => speed * sensitivityAt(speed))
      const maxOutput = Math.max(...outputs, 1)
      ctx.strokeStyle = '#52c1ff'
      ctx.setLineDash([6, 6])
      ctx.lineWidth = 2
      ctx.beginPath()
      outputs.forEach((output, idx) => {
        const normalized = (output / maxOutput) * axisMaxY
        const x = toX(speeds[idx])
        const y = toY(normalized)
        if (idx === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()
      ctx.setLineDash([])
    }

    drawVelocityCurve()

    const resolveLive = () => {
      if (typeof omega === 'number' && Number.isFinite(omega)) {
        return {
          speed: clamp(omega, 0, axisMaxX),
          sensX: typeof currentSensX === 'number' ? currentSensX : sensitivityAt(omega),
        }
      }
      return null
    }

    const live = resolveLive()
    if (live && !disableLiveDot) {
      const speed = clamp(live.speed, 0, axisMaxX)
      const sensX = live.sensX ?? sensitivityAt(speed)
      const output = speed * sensX
      const maxOutput = axisMaxX * maxSensX
      const normalizedOutput = (output / maxOutput) * axisMaxY

      const drawDot = (value: number, color: string) => {
        ctx.beginPath()
        ctx.arc(toX(speed), toY(value), 5, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
      }
      drawDot(sensX, LIVE_SENS_COLOR)
      drawDot(normalizedOutput, LIVE_OUTPUT_COLOR)
    }

    ctx.textAlign = 'center'
  }, [minThreshold, maxThreshold, minSensX, minSensY, maxSensX, maxSensY, normalized, currentSensX, omega, disableLiveDot, curveType, naturalVHalf, powerVRef, powerExponent])

  return <canvas ref={canvasRef} className="legacy-curve-canvas" />
}
