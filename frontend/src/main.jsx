import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

console.log('🔥🔥🔥 [MAIN.JSX] React main.jsx loaded! 🔥🔥🔥');
console.log('🔥🔥🔥 [MAIN.JSX] About to render React app... 🔥🔥🔥');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

console.log('🔥🔥🔥 [MAIN.JSX] React app rendered! 🔥🔥🔥');
