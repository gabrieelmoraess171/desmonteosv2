import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-muted">Carregando sessão...</div>;
  }

  // Preserva o resultado do OAuth do Mercado Livre durante o login.
  return isAuthenticated ? (
    <Outlet />
  ) : (
    <Navigate to={{ pathname: '/login', search: location.search }} replace />
  );
}
