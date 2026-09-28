import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@capra/theme/base.css'
import '@capra/core/styles.css'
import '@capra/icons/styles.css'
import '@xyflow/react/dist/style.css'
import App from './App'
import './theme.css'
import './App.css'

// Dark is the app's default look (Cribl's product chrome); see theme.css.
document.documentElement.classList.add('dark')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
