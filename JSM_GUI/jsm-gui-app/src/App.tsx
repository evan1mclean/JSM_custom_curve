import './App.css'
import { useTelemetry } from './hooks/useTelemetry'

function App() {
  const { sample, isCalibrating, countdown } = useTelemetry()

  return (
    <div className="App">
      <h1>JSM Telemetry (React)</h1>
      {isCalibrating && (
        <div className="calibration-banner">
          Calibrating... {countdown ?? ''}
        </div>
      )}
      {sample ? (
        <pre>{JSON.stringify(sample, null, 2)}</pre>
      ) : (
        <p>Waiting for telemetry...</p>
      )}
    </div>
  )
}

export default App
