import React from 'react'
import ReactDOM from 'react-dom/client'
import axios from 'axios'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import App from './App'
import Login from './components/Login'
import ProtectedRoute from './components/ProtectedRoute'
import AppErrorBoundary from './components/AppErrorBoundary'
import { AuthProvider } from './hooks/useAuth'
import { API_URL } from './config/api'
import './index.css'

axios.defaults.baseURL = API_URL
// Em produção, configure VITE_API_URL com a URL pública do backend.
// O fallback mantém o frontend compatível com a publicação atual no Render.

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/*" element={<App />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  </React.StrictMode>,
)
