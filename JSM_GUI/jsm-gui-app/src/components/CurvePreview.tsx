import { SensitivityValues } from '../utils/keymap'
import { SensitivityGraph } from './SensitivityGraph'
import { TelemetrySample } from '../hooks/useTelemetry'

type CurvePreviewProps = {
  sensitivity: SensitivityValues
  sample: TelemetrySample | null
  hasPendingChanges: boolean
}

export function CurvePreview({ sensitivity, sample, hasPendingChanges }: CurvePreviewProps) {
  const asNumber = (value: unknown) => (typeof value === 'number' ? value : undefined)
  return (
    <section className="graph-panel">
      <h2>Curve Preview</h2>
      <div className="graph-legend">
        <span><span className="legend-dot sensitivity" /> Sensitivity</span>
        <span><span className="legend-dot velocity" /> Normalized output velocity</span>
        <span className="legend-curve">Curve: {sample?.curve ?? 'linear'}</span>
      </div>
      <SensitivityGraph
        minThreshold={sensitivity.minThreshold}
        maxThreshold={sensitivity.maxThreshold}
        minSensX={sensitivity.minSensX}
        minSensY={sensitivity.minSensY}
        maxSensX={sensitivity.maxSensX}
        maxSensY={sensitivity.maxSensY}
        normalized={asNumber(sample?.t)}
        currentSensX={asNumber(sample?.sensX)}
        omega={asNumber(sample?.omega)}
        disableLiveDot={hasPendingChanges}
      />
      <small>Live dot follows telemetry t-value using yaw sensitivity.</small>
    </section>
  )
}
