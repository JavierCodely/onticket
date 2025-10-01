
import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/services/AuthContext';
import { ThemeProvider } from '@/shared/contexts/ThemeContext';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { Login } from '@/features/auth/components/Login';
import { useAuth } from '@/features/auth/hooks/useAuth';

// Lazy loading de los Dashboards
const Dashboard = React.lazy(() => import('@/features/dashboard/components/Dashboard').then(module => ({ default: module.Dashboard })));
const EmployeeDashboard = React.lazy(() => import('@/features/dashboard/components/EmployeeDashboard').then(module => ({ default: module.EmployeeDashboard })));

// Componente para redireccionar desde la raíz
const RootRedirect: React.FC = () => {
  const { isAuthenticated, userRole, isLoading, admin, employee } = useAuth();

  // Debug logging
  console.log('RootRedirect Debug:', {
    isLoading,
    isAuthenticated,
    userRole,
    hasAdmin: !!admin,
    hasEmployee: !!employee,
    adminStatus: admin?.status,
    employeeStatus: employee?.status
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    console.log('Not authenticated, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  // Redirigir según el rol del usuario
  if (userRole === 'admin') {
    console.log('Admin user, redirecting to /admin');
    return <Navigate to="/admin" replace />;
  } else if (userRole === 'employee') {
    console.log('Employee user, redirecting to /employee');
    return <Navigate to="/employee" replace />;
  } else {
    console.log('No valid role, redirecting to login. UserRole:', userRole);
    return <Navigate to="/login" replace />;
  }
};

function App() {
  const LoadingSpinner = (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
    </div>
  );

  return (
    <ThemeProvider>
      <Router>
        <AuthProvider>
          <Routes>
            {/* Ruta raíz - redirige basado en autenticación y rol */}
            <Route path="/" element={<RootRedirect />} />

            {/* Ruta de login */}
            <Route path="/login" element={<Login />} />

            {/* Rutas para administradores */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute requireAdmin={true}>
                  <Suspense fallback={LoadingSpinner}>
                    <Dashboard />
                  </Suspense>
                </ProtectedRoute>
              }
            />

            {/* Rutas para empleados */}
            <Route
              path="/employee"
              element={
                <ProtectedRoute allowedRoles={['employee']}>
                  <Suspense fallback={LoadingSpinner}>
                    <EmployeeDashboard />
                  </Suspense>
                </ProtectedRoute>
              }
            />

            {/* Ruta legacy para compatibilidad */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute requireAdmin={true}>
                  <Suspense fallback={LoadingSpinner}>
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
    </ThemeProvider>
  );
}

export default App;