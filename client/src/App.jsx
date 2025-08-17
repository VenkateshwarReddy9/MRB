import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { auth } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';

// Import Page Components
import LoginPage from './pages/LoginPage';
import UserManagementPage from './pages/UserManagementPage';
import EmployeesPage from './pages/EmployeesPage';
import EditEmployeePage from './pages/EditEmployeePage';
import ShiftTemplatesPage from './pages/ShiftTemplatesPage';
import RotaPage from './pages/RotaPage';
import MyAvailabilityPage from './pages/MyAvailabilityPage';
import MySchedulePage from './pages/MySchedulePage';
import AvailabilityRequestsPage from './pages/AvailabilityRequestsPage';
import TimeEntriesAdminPage from './pages/TimeEntriesAdminPage';
import TimesheetPage from './pages/TimesheetPage';
import LaborReportPage from './pages/LaborReportPage';
import ActivityLogPage from './pages/ActivityLogPage';

// Import UI Components
import ErrorBoundary from './components/ErrorBoundary';
import AppLayout from './components/AppLayout';
import Dashboard from './components/Dashboard';

import './App.css';

// Environment-based API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Main App Component
function App() {
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        firebaseUser.getIdToken().then(token => {
          fetch(`${API_BASE_URL}/api/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
          .then(res => {
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            return res.json();
          })
          .then(profileData => {
            if (profileData.uid) {
              setUserProfile(profileData);
              setAuthError('');
            } else {
              signOut(auth);
              setUserProfile(null);
              setAuthError('Invalid user profile');
            }
            setLoading(false);
          })
          .catch(error => {
            console.error('Profile fetch error:', error);
            setAuthError('Failed to load user profile');
            signOut(auth);
            setUserProfile(null);
            setLoading(false);
          });
        }).catch(error => {
          console.error('Token error:', error);
          setAuthError('Authentication failed');
          signOut(auth);
          setUserProfile(null);
          setLoading(false);
        });
      } else {
        setUserProfile(null);
        setAuthError('');
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="bg-slate-950 text-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading MR BURGER Back Office...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="bg-slate-950 text-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-6">
            <h3 className="text-red-400 font-semibold mb-2">Authentication Error</h3>
            <p className="text-red-300 mb-4">{authError}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={!userProfile ? <LoginPage /> : <Navigate to="/" />} />
        <Route path="/*" element={ userProfile ? <AppLayout userProfile={userProfile} onLogout={() => signOut(auth)} /> : <Navigate to="/login" /> }>
          <Route index element={<Dashboard userProfile={userProfile} />} />

          {/* Staff-accessible routes */}
          <Route path="my-availability" element={<MyAvailabilityPage />} />
          <Route path="my-schedule" element={<MySchedulePage />} />

          {/* Admin-only routes */}
          <Route path="users" element={ (userProfile && userProfile.role.includes('admin')) ? <UserManagementPage userProfile={userProfile} /> : <Navigate to="/" /> } />
          <Route path="employees" element={ (userProfile && userProfile.role.includes('admin')) ? <EmployeesPage /> : <Navigate to="/" /> } />
          <Route path="employees/:uid/edit" element={ (userProfile && userProfile.role.includes('admin')) ? <EditEmployeePage /> : <Navigate to="/" /> } />
          <Route path="shift-templates" element={ (userProfile && userProfile.role.includes('admin')) ? <ShiftTemplatesPage /> : <Navigate to="/" /> } />
          <Route path="rota" element={ (userProfile && userProfile.role.includes('admin')) ? <RotaPage /> : <Navigate to="/" /> } />
          <Route path="time-entries" element={ (userProfile && userProfile.role.includes('admin')) ? <TimeEntriesAdminPage /> : <Navigate to="/" /> } />
          <Route path="activity-log" element={ (userProfile && userProfile.role.includes('admin')) ? <ActivityLogPage /> : <Navigate to="/" /> } />
          <Route path="availability-requests" element={ (userProfile && userProfile.role.includes('admin')) ? <AvailabilityRequestsPage /> : <Navigate to="/" /> } />
          <Route path="timesheet" element={ (userProfile && userProfile.role.includes('admin')) ? <TimesheetPage /> : <Navigate to="/" /> } />
          <Route path="reports/labor" element={ (userProfile && userProfile.role.includes('admin')) ? <LaborReportPage /> : <Navigate to="/" /> } />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
