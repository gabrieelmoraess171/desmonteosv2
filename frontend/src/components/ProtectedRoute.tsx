import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  // Preserva o resultado do OAuth do Mercado Livre durante o login.
  return isAuthenticated ? (
    <Outlet />
  ) : (
    <Navigate to={{ pathname: '/login', search: location.search }} replace />
  );
}
