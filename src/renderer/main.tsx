import ReactDOM from 'react-dom/client'
import App from './App'
import './features/theme/theme.css'
import './styles/global.css'

// Note: React.StrictMode is intentionally omitted. In dev it double-invokes
// effects, which would mount/unmount the epub.js adapter twice per book open.
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<App />)
