import { useEffect, useRef } from 'react'

interface SensitivityGraphProps {
  minThreshold?: number
  maxThreshold?: number
  minSensX?: number
  maxSensX?: number
  minSensY?: number
  maxSensY?: number
  normalized?: number
  currentSensX?: number
  omega?: number
}

const MAX_OMEGA = 500

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export function SensitivityGraph(props: SensitivityGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const {
      minThreshold,
      maxThreshold,
      minSensX,
      minSensY,
      maxSensX,
      maxSensY,
      normalized,
      currentSensX,
      currentSensY,
      omega,
    } = props

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

    if (
      minThreshold === undefined ||
      maxThreshold === undefined ||
      minSensX === undefined ||
      maxSensX === undefined
    ) {
      ctx.fillStyle = '#777'
      ctx.font = '16px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Provide min/max sensitivity + thresholds to preview.', baseWidth / 2, baseHeight / 2)
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

    const axisMaxX = Math.max(MAX_OMEGA, maxThreshold)
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

    const drawSensitivityCurve = () => {
      ctx.strokeStyle = '#6a8bff'
      ctx.lineWidth = 2.2
      ctx.beginPath()
      ctx.moveTo(toX(0), toY(minSensX))
      ctx.lineTo(toX(minThreshold), toY(minSensX))
      ctx.lineTo(toX(maxThreshold), toY(maxSensX))
      ctx.lineTo(toX(axisMaxX), toY(maxSensX))
      ctx.stroke()
    }

    drawSensitivityCurve()

    const denom = maxThreshold - minThreshold
    const sensitivityAt = (speed: number) => {
      if (denom <= 0) {
        return speed > minThreshold ? maxSensX : minSensX
      }
      const progress = clamp((speed - minThreshold) / denom, 0, 1)
      return minSensX + progress * (maxSensX - minSensX)
    }

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
          sensX: typeof currentSensX === 'number' ? currentSensX : undefined,
        }
      }
      if (typeof normalized === 'number' && Number.isFinite(normalized)) {
          const t = clamp(normalized, 0, 1)
          const speed = minThreshold + t * (maxThreshold - minThreshold)
          const sensX = minSensX + t * (maxSensX - minSensX)
          return { speed, sensX }
      }
      return null
    }

    const live = resolveLive()
    if (live) {
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
      drawDot(sensX, '#6a8bff')
      drawDot(normalizedOutput, '#52c1ff')

    ctx.fillStyle = '#ddd'
    ctx.font = '12px monospace'
    ctx.textAlign = 'right'
    ctx.fillText(`LIVE → SPEED: ${speed.toFixed(1)}°/s`, baseWidth - 20, paddingTop + graphHeight - 20)
    ctx.fillText(`Sensitivity: ${sensX.toFixed(3)}`, baseWidth - 20, paddingTop + graphHeight - 4)
    }

    ctx.textAlign = 'center'
  }, [
    props.minThreshold,
    props.maxThreshold,
    props.minSensX,
    props.minSensY,
    props.maxSensX,
    props.maxSensY,
    props.normalized,
    props.currentSensX,
    props.omega,
  ])

  return <canvas ref={canvasRef} className="legacy-curve-canvas" />
}
