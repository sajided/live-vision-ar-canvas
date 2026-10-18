import { MotionConfig } from 'motion/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { unlockAudioOnFirstGesture } from './feedback/feedback'
import { unlockNarrationOnFirstGesture } from './tutor/narrator'

unlockAudioOnFirstGesture()
unlockNarrationOnFirstGesture()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Honour the OS "reduce motion" setting for springs, slides and scaling. */}
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
)
