
import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/services/AuthContext';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { Login } from '@/features/auth/components/Login';
import { useAuth } from '@/features/auth/hooks/useAuth';

// Lazy loading del Dashboard - se carga solo cuando es necesario
const Dashboard = React.lazy(() => import('@/features/dashboard/components/Dashboard').then(module => ({ default: module.Dashboard })));

// Componente para redireccionar desde la raíz
const RootRedirect: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Ruta raíz - redirige basado en autenticación */}
          <Route path="/" element={<RootRedirect />} />
          
          {/* Ruta de login */}
          <Route path="/login" element={<Login />} />
          
          {/* Rutas protegidas */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute requireAdmin={true}>
                <Suspense fallback={
                  <div className="min-h-screen flex items-center justify-center">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
                  </div>
                }>
                  <Dashboard />
                </Suspense>
              </ProtectedRoute>
            }
          />
          
          {/* Ruta catch-all - redirige a la raíz */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;