import { SensitivityValues } from '../utils/keymap'
import { SensitivityGraph } from './SensitivityGraph'
import { TelemetrySample } from '../hooks/useTelemetry'

type CurvePreviewProps = {
  sensitivity: SensitivityValues
  sample: TelemetrySample | null
  hasPendingChanges: boolean
  telemetry: {
    omega: string
    sensX: string
    sensY: string
    timestamp: string
  }
}

export function CurvePreview({ sensitivity, sample, hasPendingChanges, telemetry }: CurvePreviewProps) {
  const asNumber = (value: unknown) => (typeof value === 'number' ? value : undefined)
  const curveType = (sensitivity.accelCurve ?? 'LINEAR').toUpperCase() as 'LINEAR' | 'NATURAL' | 'POWER'
  return (
    <div className="graph-panel">
      <div className="graph-legend">
        <span><span className="legend-dot sensitivity" /> Sensitivity</span>
        <span><span className="legend-dot velocity" /> Normalized output velocity</span>
      </div>
      <SensitivityGraph
        minThreshold={sensitivity.minThreshold}
        maxThreshold={sensitivity.maxThreshold}
        minSensX={sensitivity.minSensX}
        minSensY={sensitivity.minSensY}
        maxSensX={sensitivity.maxSensX}
        maxSensY={sensitivity.maxSensY}
        curveType={curveType}
        naturalVHalf={sensitivity.naturalVHalf}
        powerVRef={sensitivity.powerVRef}
        powerExponent={sensitivity.powerExponent}
        normalized={asNumber(sample?.t)}
        currentSensX={asNumber(sample?.sensX)}
        omega={asNumber(sample?.omega)}
        disableLiveDot={hasPendingChanges}
      />
      <div className="graph-live-readout">
        <span>Gyro Speed: <strong>{telemetry.omega}°/s</strong></span>
        <span>Active Sens: <strong>{telemetry.sensX}/{telemetry.sensY}</strong></span>
      </div>
    </div>
  )
}
