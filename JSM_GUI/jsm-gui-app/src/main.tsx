import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initI18n } from './i18n'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element not found')
}

const root = ReactDOM.createRoot(rootElement)

const renderApp = () => {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

void initI18n()
  .catch((error) => {
    console.error('Failed to initialize i18n', error)
  })
  .finally(renderApp)
