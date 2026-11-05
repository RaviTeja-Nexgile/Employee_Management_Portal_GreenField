// Mounts the app. The IBM Plex Sans faces are loaded through the Font
// Loading API before the app renders text; if loading fails, a non-text
// retry control is shown instead of rendering in another font.

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './auth'
import './styles.css'

const FONT_FACES = [
  '400 16px "IBM Plex Sans"',
  '500 16px "IBM Plex Sans"',
  '600 16px "IBM Plex Sans"',
]

function renderApp() {
  const container = document.getElementById('root')
  if (!container) return
  createRoot(container).render(
    <StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </StrictMode>,
  )
}

function renderFontError() {
  const container = document.getElementById('root')
  if (!container) return
  container.innerHTML = ''
  const wrapper = document.createElement('div')
  wrapper.className = 'font-error'
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'font-error__retry'
  button.setAttribute('aria-label', 'Retry loading the application font')
  button.textContent = '\u21bb'
  button.addEventListener('click', () => {
    window.location.reload()
  })
  wrapper.appendChild(button)
  container.appendChild(wrapper)
}

async function loadFonts(): Promise<boolean> {
  if (typeof document === 'undefined' || !('fonts' in document)) return true
  try {
    await Promise.all(FONT_FACES.map((face) => document.fonts.load(face)))
    await document.fonts.ready
    return document.fonts.check('400 16px "IBM Plex Sans"')
  } catch {
    return false
  }
}

loadFonts().then((ok) => {
  if (ok) {
    renderApp()
  } else {
    renderFontError()
  }
})
