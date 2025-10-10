import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/shared/Layout';
import Login from './components/shared/Login';
import Register from './components/shared/Register';
import CustomerDashboard from './components/customer/Dashboard';
import CreateDelivery from './components/customer/CreateDelivery';
import DeliveryDetails from './components/customer/DeliveryDetails';
// Removed MapPage import
import AgentDashboard from './components/agent/Dashboard';
import AgentDeliveryDetails from './components/agent/DeliveryDetails';
import Map from './components/agent/Map';
import AdminDashboard from './components/admin/Dashboard';
import AdminUsers from './components/admin/Users';
import AdminDeliveries from './components/admin/Deliveries';
import AdminRiskAlerts from './components/admin/RiskAlerts';

// Protected route component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to appropriate dashboard based on role
    switch (user.role) {
      case 'admin':
        return <Navigate to="/admin/dashboard" />;
      case 'agent':
        return <Navigate to="/agent/dashboard" />;
      case 'customer':
      default:
        return <Navigate to="/customer/dashboard" />;
    }
  }
  
  return children;
};

// Public route component
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  if (user) {
    // Redirect to appropriate dashboard based on role
    switch (user.role) {
      case 'admin':
        return <Navigate to="/admin/dashboard" />;
      case 'agent':
        return <Navigate to="/agent/dashboard" />;
      case 'customer':
      default:
        return <Navigate to="/customer/dashboard" />;
    }
  }
  
  return children;
};

// Main App component
function AppContent() {
  const { user, logout } = useAuth();
  
  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        } />
        <Route path="/register" element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        } />
        
        {/* Customer routes */}
        <Route path="/customer/*" element={
          <ProtectedRoute allowedRoles={['customer']}>
            <Layout user={user} onLogout={logout}>
              <Routes>
                <Route index element={<Navigate to="/customer/dashboard" />} />
                <Route path="dashboard" element={<CustomerDashboard />} />
                {/* Removed map route */}
                <Route path="create-delivery" element={<CreateDelivery />} />
                <Route path="deliveries/:id" element={<DeliveryDetails />} />
                <Route path="my-deliveries" element={<CustomerDashboard />} />
                {/* Add more customer routes here */}
              </Routes>
            </Layout>
          </ProtectedRoute>
        } />
        
        {/* Agent routes */}
        <Route path="/agent/*" element={
          <ProtectedRoute allowedRoles={['agent']}>
            <Layout user={user} onLogout={logout}>
              <Routes>
                <Route index element={<Navigate to="/agent/dashboard" />} />
                <Route path="dashboard" element={<AgentDashboard />} />
                <Route path="deliveries" element={<AgentDashboard />} />
                <Route path="deliveries/:id" element={<AgentDeliveryDetails />} />
                <Route path="map" element={<Map />} />
                {/* Add more agent routes here */}
              </Routes>
            </Layout>
          </ProtectedRoute>
        } />
        
        {/* Admin routes */}
        <Route path="/admin/*" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Layout user={user} onLogout={logout}>
              <Routes>
                <Route index element={<Navigate to="/admin/dashboard" />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="deliveries" element={<AdminDeliveries />} />
                <Route path="risk-alerts" element={<AdminRiskAlerts />} />
                {/* Add more admin routes here */}
              </Routes>
            </Layout>
          </ProtectedRoute>
        } />
        
        {/* Root route */}
        <Route path="/" element={<Navigate to="/login" />} />
        
        {/* Catch all route */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}