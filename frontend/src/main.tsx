import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  // Temporarily disabled StrictMode for WebSocket debugging
  // StrictMode intentionally double-invokes effects in dev, causing reconnection issues
  // Re-enable in production or when WebSocket is stable
  <App />,
)
