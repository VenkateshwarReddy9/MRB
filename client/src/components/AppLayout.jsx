import React, { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarClock,
  CalendarCheck2,
  UserCog,
  Briefcase,
  CalendarDays,
  Plane,
  Clock,
  FileText,
  LineChart,
  History,
  LogOut,
  Bell,
  Settings,
  Search,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import logo from '../assets/generated-image.png';
import ErrorBoundary from './ErrorBoundary';
import useGreeting from '../hooks/useGreeting';
import usePageTitle from '../hooks/usePageTitle';

const AppLayout = ({ userProfile, onLogout }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsButtonRef, setSettingsButtonRef] = useState(null);
  const [notificationsButtonRef, setNotificationsButtonRef] = useState(null);
  const pageTitle = usePageTitle();
  const greeting = useGreeting();

  const isAdmin = userProfile?.role?.includes('admin') || false;
  const isStaff = userProfile?.role === 'staff' || false;

  const navLinkClass = (isActive) => `
        flex items-center px-4 py-3 mx-2 rounded-xl transition-all duration-200 group relative
        ${isActive
          ? 'bg-gradient-to-r from-emerald-500/20 to-emerald-600/10 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/10'
          : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
        }
    `;

  const handleSearch = () => {
    console.log('Search clicked');
  };

  const handleNotifications = () => {
    setShowNotifications(!showNotifications);
    setShowSettings(false);
  };

  const handleSettings = () => {
    setShowSettings(!showSettings);
    setShowNotifications(false);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showSettings || showNotifications) {
        if (settingsButtonRef && !settingsButtonRef.contains(event.target) && showSettings) {
          setShowSettings(false);
        }
        if (notificationsButtonRef && !notificationsButtonRef.contains(event.target) && showNotifications) {
          setShowNotifications(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications, showSettings, settingsButtonRef, notificationsButtonRef]);

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden">
      {/* SIDEBAR - ONLY VISUAL CHANGES */}
      <aside className={`${sidebarCollapsed ? 'w-20' : 'w-72'} bg-gradient-to-b from-[#2c3e50] to-[#34495e] border-r border-[#3498db]/30 flex flex-col shadow-2xl transition-all duration-300 flex-shrink-0`}>
        {/* Logo Area - ENHANCED VISIBILITY */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-[#3498db]/30 bg-gradient-to-r from-[#2c3e50] to-[#34495e]">
          {!sidebarCollapsed && (
            <div className="flex items-center space-x-3">
              <img src={logo} alt="MR BURGER" className="h-12 drop-shadow-lg filter brightness-125 contrast-125" />
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">Back Office</h1>
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 rounded-lg bg-[#3498db]/20 hover:bg-[#3498db]/30 transition-colors"
          >
            {sidebarCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </button>
        </div>

        {/* Navigation with Complete Staff Access */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
          <NavLink to="/" className={({ isActive }) => navLinkClass(isActive)}>
            <LayoutDashboard className="h-5 w-5 mr-3 flex-shrink-0" />
            {!sidebarCollapsed && <span>Dashboard</span>}
          </NavLink>

          {!sidebarCollapsed && (
            <div className="pt-6 pb-2">
              <p className="px-4 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                {isStaff ? 'My Workspace' : 'Personal'}
              </p>
            </div>
          )}

          <NavLink to="/my-availability" className={({ isActive }) => navLinkClass(isActive)}>
            <CalendarClock className="h-5 w-5 mr-3 flex-shrink-0" />
            {!sidebarCollapsed && <span>My Availability</span>}
          </NavLink>

          <NavLink to="/my-schedule" className={({ isActive }) => navLinkClass(isActive)}>
            <CalendarCheck2 className="h-5 w-5 mr-3 flex-shrink-0" />
            {!sidebarCollapsed && <span>My Schedule</span>}
          </NavLink>

          {isAdmin && (
            <>
              {!sidebarCollapsed && (
                <div className="pt-6 pb-2">
                  <p className="px-4 text-xs font-semibold text-slate-300 uppercase tracking-wider">Staff Management</p>
                </div>
              )}

              <NavLink to="/employees" className={({ isActive }) => navLinkClass(isActive)}>
                <Briefcase className="h-5 w-5 mr-3 flex-shrink-0" />
                {!sidebarCollapsed && <span>Employees</span>}
              </NavLink>

              <NavLink to="/availability-requests" className={({ isActive }) => navLinkClass(isActive)}>
                <Plane className="h-5 w-5 mr-3 flex-shrink-0" />
                {!sidebarCollapsed && <span>Time Off Requests</span>}
              </NavLink>

              {!sidebarCollapsed && (
                <div className="pt-6 pb-2">
                  <p className="px-4 text-xs font-semibold text-slate-300 uppercase tracking-wider">Scheduling</p>
                </div>
              )}

              <NavLink to="/rota" className={({ isActive }) => navLinkClass(isActive)}>
                <CalendarDays className="h-5 w-5 mr-3 flex-shrink-0" />
                {!sidebarCollapsed && <span>Rota</span>}
              </NavLink>

              <NavLink to="/shift-templates" className={({ isActive }) => navLinkClass(isActive)}>
                <Clock className="h-5 w-5 mr-3 flex-shrink-0" />
                {!sidebarCollapsed && <span>Shift Templates</span>}
              </NavLink>

              {!sidebarCollapsed && (
                <div className="pt-6 pb-2">
                  <p className="px-4 text-xs font-semibold text-slate-300 uppercase tracking-wider">Administration</p>
                </div>
              )}

              <NavLink to="/users" className={({ isActive }) => navLinkClass(isActive)}>
                <UserCog className="h-5 w-5 mr-3 flex-shrink-0" />
                {!sidebarCollapsed && <span>User Access</span>}
              </NavLink>

              <NavLink to="/timesheet" className={({ isActive }) => navLinkClass(isActive)}>
                <FileText className="h-5 w-5 mr-3 flex-shrink-0" />
                {!sidebarCollapsed && <span>Timesheets</span>}
              </NavLink>

              <NavLink to="/reports/labor" className={({ isActive }) => navLinkClass(isActive)}>
                <LineChart className="h-5 w-5 mr-3 flex-shrink-0" />
                {!sidebarCollapsed && <span>Labor Report</span>}
              </NavLink>

              <NavLink to="/activity-log" className={({ isActive }) => navLinkClass(isActive)}>
                <History className="h-5 w-5 mr-3 flex-shrink-0" />
                {!sidebarCollapsed && <span>Activity Log</span>}
              </NavLink>
            </>
          )}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* TOP NAVBAR - ONLY VISUAL CHANGES */}
        <header className="bg-gradient-to-r from-[#2c3e50] to-[#34495e] backdrop-blur-sm border-b border-[#3498db]/30 shadow-xl">
          <div className="px-6 py-4 flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                {pageTitle}
              </h1>
              <div className="hidden md:block w-px h-6 bg-slate-600"></div>
              <p className="hidden md:block text-slate-200 text-sm">
                {greeting}, {userProfile?.email?.split('@')[0] || 'User'}
              </p>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                isAdmin ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/30' : 'bg-blue-900/30 text-blue-400 border border-blue-500/30'
              }`}>
                {userProfile?.role?.replace('_', ' ').toUpperCase() || 'STAFF'}
              </span>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={handleSearch}
                className="p-2 rounded-xl bg-[#3498db]/20 hover:bg-[#3498db]/30 transition-colors border border-[#3498db]/30"
              >
                <Search className="h-5 w-5 text-slate-200" />
              </button>

              <button
                ref={setNotificationsButtonRef}
                onClick={handleNotifications}
                className="p-2 rounded-xl bg-[#3498db]/20 hover:bg-[#3498db]/30 transition-colors border border-[#3498db]/30 relative"
              >
                <Bell className="h-5 w-5 text-slate-200" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full"></div>
              </button>

              <button
                ref={setSettingsButtonRef}
                onClick={handleSettings}
                className="p-2 rounded-xl bg-[#3498db]/20 hover:bg-[#3498db]/30 transition-colors border border-[#3498db]/30"
              >
                <Settings className="h-5 w-5 text-slate-200" />
              </button>

              <div className="flex items-center space-x-3 pl-3 border-l border-slate-700/50">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-emerald-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm">
                  {userProfile?.email?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <button
                  onClick={onLogout}
                  className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold py-2 px-4 rounded-xl transition-all duration-200 flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-hidden bg-gradient-to-br from-slate-950 to-slate-900">
          <div className="h-full overflow-y-auto custom-scrollbar">
            <div className="p-6">
              <ErrorBoundary>
                <Outlet />
              </ErrorBoundary>
            </div>
          </div>
        </main>
      </div>

      {/* Portal-Based Dropdowns */}
      {showNotifications && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          <div
            className="absolute bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-80 pointer-events-auto"
            style={{ top: '5rem', right: '8rem' }}
          >
            <div className="p-4 border-b border-slate-700">
              <h3 className="text-white font-semibold">Notifications</h3>
            </div>
            <div className="p-4">
              <p className="text-slate-400 text-sm">No new notifications</p>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          <div
            className="absolute bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-64 pointer-events-auto"
            style={{ top: '5rem', right: '4.5rem' }}
          >
            <div className="p-4 border-b border-slate-700 bg-slate-700/30">
              <h3 className="text-white font-semibold">Settings</h3>
            </div>
            <div className="p-2">
              <button className="w-full text-left px-3 py-2 text-slate-300 hover:bg-slate-700/50 rounded-lg transition-colors text-sm">
                Profile Settings
              </button>
              <button className="w-full text-left px-3 py-2 text-slate-300 hover:bg-slate-700/50 rounded-lg transition-colors text-sm">
                Preferences
              </button>
              <button className="w-full text-left px-3 py-2 text-slate-300 hover:bg-slate-700/50 rounded-lg transition-colors text-sm">
                Theme Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppLayout;
