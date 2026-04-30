import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Report from './pages/Report';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ProfileComplete from './pages/ProfileComplete';
import NotFound from './pages/NotFound';
import MyTrades from './pages/MyTrades';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/"                 element={<Landing />} />
          <Route path="/dashboard"        element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/report/:gst"      element={<ProtectedRoute><Report /></ProtectedRoute>} />
          <Route path="/login"            element={<Login />} />
          <Route path="/signup"           element={<Signup />} />
          <Route path="/profile/complete" element={<ProtectedRoute><ProfileComplete /></ProtectedRoute>} />
          <Route path="/my-trades"        element={<ProtectedRoute><MyTrades /></ProtectedRoute>} />
          <Route path="*"                 element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
