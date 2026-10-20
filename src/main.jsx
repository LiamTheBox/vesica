import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { installDevHook } from './debug/devHook'
import './index.css'

if (import.meta.env.DEV) installDevHook()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
