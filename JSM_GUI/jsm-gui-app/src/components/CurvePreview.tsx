import { useTranslation } from 'react-i18next'
import { TelemetrySample } from '../hooks/useTelemetry'
import { SensitivityValues } from '../utils/keymap'
import graphStyles from './Graph.module.css'
import { SensitivityGraph } from './SensitivityGraph'

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
  const { t } = useTranslation()
  const asNumber = (value: unknown) => (typeof value === 'number' ? value : undefined)
  const curveType = (sensitivity.accelCurve ?? 'LINEAR').toUpperCase() as
    | 'LINEAR'
    | 'NATURAL'
    | 'POWER'
    | 'QUADRATIC'
    | 'SIGMOID'
    | 'JUMP'

  return (
    <div className={graphStyles.graphPanel}>
      <div className={graphStyles.graphLegend}>
        <span>
          <span className={`${graphStyles.legendDot} ${graphStyles.legendDotSensitivity}`} /> {t('curvePreview.sensitivity')}
        </span>
        <span>
          <span className={`${graphStyles.legendDot} ${graphStyles.legendDotVelocity}`} />{' '}
          {t('curvePreview.normalizedOutputVelocity')}
        </span>
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
        sigmoidMid={sensitivity.sigmoidMid}
        sigmoidWidth={sensitivity.sigmoidWidth}
        jumpTau={sensitivity.jumpTau}
        normalized={asNumber(sample?.t)}
        currentSensX={asNumber(sample?.sensX)}
        omega={asNumber(sample?.omega)}
        disableLiveDot={hasPendingChanges}
      />
      <div className={graphStyles.graphLiveReadout}>
        <span>
          {t('curvePreview.gyroSpeed')}: <strong>{telemetry.omega} deg/s</strong>
        </span>
        <span>
          {t('curvePreview.activeSensitivity')}: <strong>{telemetry.sensX}/{telemetry.sensY}</strong>
        </span>
      </div>
    </div>
  )
}
