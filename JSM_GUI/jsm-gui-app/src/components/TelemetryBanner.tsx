type TelemetryBannerProps = {
  omega: string
  normalized: string
  sensX: string
  sensY: string
  timestamp: string
}

export function TelemetryBanner({ omega, normalized, sensX, sensY, timestamp }: TelemetryBannerProps) {
  return (
    <section className="telemetry-banner">
      <p className="telemetry-heading">Live packets streaming</p>
      <div className="telemetry-readouts">
        <span>ω: <strong>{omega}°/s</strong></span>
        <span>t: <strong>{normalized}</strong></span>
        <span>Sens X/Y: <strong>{sensX}/{sensY}</strong></span>
        <span>Timestamp: <strong>{timestamp}</strong></span>
      </div>
    </section>
  )
}
