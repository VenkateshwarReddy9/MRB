import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';
import { auth } from './firebase';
import { onAuthStateChanged, signOut } from "firebase/auth";
import logo from './assets/generated-image.png';
import { apiService } from './services/api';

// Import Modern Icons from Lucide-React
import {
  LayoutDashboard,
  CalendarClock,
  CalendarCheck2,
  Users,
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
  Menu,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

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
import AddExpenseForm from './components/AddExpenseForm';
import AddSaleForm from './components/AddSaleForm';
import TransactionList from './components/TransactionList';
import ApprovalQueue from './components/ApprovalQueue';
import TimeClock from './components/TimeClock';
import RealTimeAnalytics from './components/RealTimeAnalytics';
import ErrorBoundary from './components/ErrorBoundary';

import './App.css';

// Environment-based API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Helper function for greetings
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

// Helper function to get page title from URL path
const getPageTitle = (pathname) => {
  if (pathname.match(/^\/employees\/.*\/edit$/)) {
    return 'Edit Employee';
  }
  const titles = {
    '/': 'Dashboard',
    '/my-availability': 'My Availability',
    '/my-schedule': 'My Schedule',
    '/users': 'User Access',
    '/employees': 'Employees',
    '/rota': 'Rota',
    '/availability-requests': 'Time Off Requests',
    '/shift-templates': 'Shift Templates',
    '/timesheet': 'Timesheets',
    '/reports/labor': 'Labor Report',
    '/activity-log': 'Activity Log',
    '/time-entries': 'Time Entries'
  };
  return titles[pathname] || 'Dashboard';
};

// FIXED: Modern Dashboard Summary Component with Enhanced Error Handling
const DashboardSummary = ({ summary }) => {
    // Add null checks and default values to prevent undefined errors
    const safeSummary = {
        todaysSales: parseFloat(summary?.todaysSales || 0),
        todaysExpenses: parseFloat(summary?.todaysExpenses || 0),
        yesterdaysSales: parseFloat(summary?.yesterdaysSales || 0),
        yesterdaysExpenses: parseFloat(summary?.yesterdaysExpenses || 0),
        todaysSaleCount: parseInt(summary?.todaysSaleCount || 0),
        todaysExpenseCount: parseInt(summary?.todaysExpenseCount || 0),
        avgSaleAmount: parseFloat(summary?.avgSaleAmount || 0),
        maxSaleAmount: parseFloat(summary?.maxSaleAmount || 0)
    };

    const todaysProfit = safeSummary.todaysSales - safeSummary.todaysExpenses;
    const yesterdaysProfit = safeSummary.yesterdaysSales - safeSummary.yesterdaysExpenses;
    const profitClass = (profit) => profit >= 0 ? 'text-emerald-400' : 'text-red-400';

    return (
        <div className="space-y-8 mb-8">
            {/* Modern Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Today's Sales */}
                <div className="group relative bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 backdrop-blur-sm border border-emerald-500/20 rounded-2xl p-6 hover:border-emerald-400/40 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/10">
                    <div className="absolute top-4 right-4">
                        <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center group-hover:bg-emerald-500/30 transition-colors">
                            <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <p className="text-slate-400 text-sm font-medium">Today's Sales</p>
                        <p className="text-3xl font-bold text-emerald-400">£{safeSummary.todaysSales.toFixed(2)}</p>
                        <p className="text-xs text-slate-500">{safeSummary.todaysSaleCount} transactions</p>
                    </div>
                </div>

                {/* Today's Expenses */}
                <div className="group relative bg-gradient-to-br from-red-500/10 to-red-600/5 backdrop-blur-sm border border-red-500/20 rounded-2xl p-6 hover:border-red-400/40 transition-all duration-300 hover:shadow-2xl hover:shadow-red-500/10">
                    <div className="absolute top-4 right-4">
                        <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center group-hover:bg-red-500/30 transition-colors">
                            <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                            </svg>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <p className="text-slate-400 text-sm font-medium">Today's Expenses</p>
                        <p className="text-3xl font-bold text-red-400">£{safeSummary.todaysExpenses.toFixed(2)}</p>
                        <p className="text-xs text-slate-500">{safeSummary.todaysExpenseCount} transactions</p>
                    </div>
                </div>

                {/* Average Sale */}
                <div className="group relative bg-gradient-to-br from-blue-500/10 to-blue-600/5 backdrop-blur-sm border border-blue-500/20 rounded-2xl p-6 hover:border-blue-400/40 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/10">
                    <div className="absolute top-4 right-4">
                        <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
                            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <p className="text-slate-400 text-sm font-medium">Average Sale</p>
                        <p className="text-3xl font-bold text-blue-400">£{safeSummary.avgSaleAmount.toFixed(2)}</p>
                        <p className="text-xs text-slate-500">Max: £{safeSummary.maxSaleAmount.toFixed(2)}</p>
                    </div>
                </div>

                {/* Today's Profit */}
                <div className="group relative bg-gradient-to-br from-purple-500/10 to-purple-600/5 backdrop-blur-sm border border-purple-500/20 rounded-2xl p-6 hover:border-purple-400/40 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/10">
                    <div className="absolute top-4 right-4">
                        <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
                            <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                            </svg>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <p className="text-slate-400 text-sm font-medium">Today's Profit</p>
                        <p className={`text-3xl font-bold ${profitClass(todaysProfit)}`}>
                            {todaysProfit >= 0 ? `£${todaysProfit.toFixed(2)}` : `-£${Math.abs(todaysProfit).toFixed(2)}`}
                        </p>
                        <p className="text-xs text-slate-500">Net result</p>
                    </div>
                </div>
            </div>
            
            {/* Modern Balance Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="relative bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 hover:border-slate-600/50 transition-all duration-300 hover:shadow-2xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent rounded-2xl"></div>
                    <div className="relative text-center space-y-4">
                        <h3 className="text-slate-300 text-lg font-semibold">Today's Performance</h3>
                        <p className={`text-5xl font-bold ${profitClass(todaysProfit)}`}>
                            {todaysProfit >= 0 ? `£${todaysProfit.toFixed(2)}` : `-£${Math.abs(todaysProfit).toFixed(2)}`}
                        </p>
                        <p className="text-slate-500 text-sm">Net profit/loss</p>
                    </div>
                </div>
                
                <div className="relative bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 hover:border-slate-600/50 transition-all duration-300 hover:shadow-2xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent rounded-2xl"></div>
                    <div className="relative text-center space-y-4">
                        <h3 className="text-slate-300 text-lg font-semibold">Yesterday's Performance</h3>
                        <p className={`text-5xl font-bold ${profitClass(yesterdaysProfit)}`}>
                            {yesterdaysProfit >= 0 ? `£${yesterdaysProfit.toFixed(2)}` : `-£${Math.abs(yesterdaysProfit).toFixed(2)}`}
                        </p>
                        <p className="text-slate-500 text-sm">Previous performance</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// FIXED: Enhanced AppLayout Component with Complete Staff Access and All Features
const AppLayout = ({ userProfile, onLogout }) => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [settingsButtonRef, setSettingsButtonRef] = useState(null);
    const [notificationsButtonRef, setNotificationsButtonRef] = useState(null);
    const location = useLocation();
    const pageTitle = getPageTitle(location.pathname);

    // FIXED: Helper function to check user permissions
    const isAdmin = userProfile?.role?.includes('admin') || false;
    const isStaff = userProfile?.role === 'staff' || false;

    const navLinkClass = (isActive) => `
        flex items-center px-4 py-3 mx-2 rounded-xl transition-all duration-200 group relative
        ${isActive 
            ? 'bg-gradient-to-r from-emerald-500/20 to-emerald-600/10 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/10' 
            : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
        }
    `;

    // Handle search functionality
    const handleSearch = () => {
        console.log('Search clicked');
    };

    // Handle notifications
    const handleNotifications = () => {
        setShowNotifications(!showNotifications);
        setShowSettings(false);
    };

    // Handle settings
    const handleSettings = () => {
        setShowSettings(!showSettings);
        setShowNotifications(false);
    };

    // Close dropdowns when clicking outside
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

                {/* FIXED: Navigation with Complete Staff Access */}
                <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
                    {/* Dashboard - Available to all users */}
                    <NavLink to="/" className={({ isActive }) => navLinkClass(isActive)}>
                        <LayoutDashboard className="h-5 w-5 mr-3 flex-shrink-0" />
                        {!sidebarCollapsed && <span>Dashboard</span>}
                    </NavLink>

                    {/* FIXED: Staff Personal Section - Always visible to staff */}
                    {!sidebarCollapsed && (
                        <div className="pt-6 pb-2">
                            <p className="px-4 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                                {isStaff ? 'My Workspace' : 'Personal'}
                            </p>
                        </div>
                    )}
                    
                    {/* FIXED: My Availability - Available to ALL users including staff */}
                    <NavLink to="/my-availability" className={({ isActive }) => navLinkClass(isActive)}>
                        <CalendarClock className="h-5 w-5 mr-3 flex-shrink-0" />
                        {!sidebarCollapsed && <span>My Availability</span>}
                    </NavLink>
                    
                    {/* FIXED: My Schedule - Available to ALL users including staff */}
                    <NavLink to="/my-schedule" className={({ isActive }) => navLinkClass(isActive)}>
                        <CalendarCheck2 className="h-5 w-5 mr-3 flex-shrink-0" />
                        {!sidebarCollapsed && <span>My Schedule</span>}
                    </NavLink>

                    {/* Admin-only sections */}
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
                                {getGreeting()}, {userProfile?.email?.split('@')[0] || 'User'}
                            </p>
                            {/* FIXED: Role indicator */}
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                isAdmin ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/30' : 'bg-blue-900/30 text-blue-400 border border-blue-500/30'
                            }`}>
                                {userProfile?.role?.replace('_', ' ').toUpperCase() || 'STAFF'}
                            </span>
                        </div>
                        
                        <div className="flex items-center space-x-3">
                            {/* Search Button */}
                            <button 
                                onClick={handleSearch}
                                className="p-2 rounded-xl bg-[#3498db]/20 hover:bg-[#3498db]/30 transition-colors border border-[#3498db]/30"
                            >
                                <Search className="h-5 w-5 text-slate-200" />
                            </button>
                            
                            {/* Notifications Button */}
                            <button 
                                ref={setNotificationsButtonRef}
                                onClick={handleNotifications}
                                className="p-2 rounded-xl bg-[#3498db]/20 hover:bg-[#3498db]/30 transition-colors border border-[#3498db]/30 relative"
                            >
                                <Bell className="h-5 w-5 text-slate-200" />
                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full"></div>
                            </button>
                            
                            {/* Settings Button */}
                            <button 
                                ref={setSettingsButtonRef}
                                onClick={handleSettings}
                                className="p-2 rounded-xl bg-[#3498db]/20 hover:bg-[#3498db]/30 transition-colors border border-[#3498db]/30"
                            >
                                <Settings className="h-5 w-5 text-slate-200" />
                            </button>
                            
                            {/* Profile & Logout */}
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

                {/* Main Content */}
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
                        style={{
                            top: '5rem',
                            right: '8rem'
                        }}
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
                        style={{
                            top: '5rem',
                            right: '4.5rem'
                        }}
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

// FIXED: Enhanced Dashboard Component with Complete Refresh Logic and All Issues Resolved
const Dashboard = ({ userProfile }) => {
    const [transactions, setTransactions] = useState([]);
    const [summary, setSummary] = useState({ 
        todaysExpenses: 0, 
        yesterdaysExpenses: 0, 
        todaysSales: 0, 
        yesterdaysSales: 0,
        todaysSaleCount: 0,
        todaysExpenseCount: 0,
        avgSaleAmount: 0,
        maxSaleAmount: 0
    });
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [editingTransaction, setEditingTransaction] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    const isAdmin = userProfile?.role?.includes('admin') || false;

    // FIXED: Enhanced refreshData function with proper error handling and state updates
    const refreshData = useCallback(async (date = selectedDate, forceRefresh = false) => {
        if (!auth.currentUser || !userProfile) return;
        
        setLoading(true);
        setError('');
        
        try {
            const token = await auth.currentUser.getIdToken();
            
            // FIXED: Fetch transactions with proper error handling
            const transactionEndpoint = isAdmin 
                ? `/api/transactions/all?date=${date}&limit=100`
                : `/api/transactions?date=${date}&limit=100`;
            
            const transactionResponse = await fetch(`${API_BASE_URL}${transactionEndpoint}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!transactionResponse.ok) {
                throw new Error(`Failed to fetch transactions: ${transactionResponse.status}`);
            }
            
            const transactionData = await transactionResponse.json();
            const sortedData = (transactionData?.data || []).sort(
                (a, b) => new Date(b.transaction_date) - new Date(a.transaction_date)
            );
            setTransactions(sortedData);

            // FIXED: Fetch dashboard summary for admins with enhanced error handling
            if (isAdmin) {
                try {
                    const summaryResponse = await fetch(`${API_BASE_URL}/api/dashboard/summary?date=${date}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    
                    if (summaryResponse.ok) {
                        const summaryData = await summaryResponse.json();
                        setSummary(prev => ({
                            ...prev, 
                            ...summaryData?.data,
                            // FIXED: Ensure all values are numbers with proper fallbacks
                            todaysSales: parseFloat(summaryData?.data?.todaysSales || 0),
                            todaysExpenses: parseFloat(summaryData?.data?.todaysExpenses || 0),
                            yesterdaysSales: parseFloat(summaryData?.data?.yesterdaysSales || 0),
                            yesterdaysExpenses: parseFloat(summaryData?.data?.yesterdaysExpenses || 0),
                            todaysSaleCount: parseInt(summaryData?.data?.todaysSaleCount || 0),
                            todaysExpenseCount: parseInt(summaryData?.data?.todaysExpenseCount || 0),
                            avgSaleAmount: parseFloat(summaryData?.data?.avgSaleAmount || 0),
                            maxSaleAmount: parseFloat(summaryData?.data?.maxSaleAmount || 0)
                        }));
                    } else {
                        console.warn('Dashboard summary failed, using existing data');
                    }
                } catch (summaryError) {
                    console.warn('Dashboard summary failed:', summaryError);
                }
            }
            
            // FIXED: Force re-render if needed
            if (forceRefresh) {
                setRefreshKey(prev => prev + 1);
            }
            
        } catch (error) {
            console.error('Error fetching data:', error);
            setError('Failed to load dashboard data. Please try refreshing the page.');
        } finally {
            setLoading(false);
        }
    }, [selectedDate, userProfile, isAdmin]);

    // Initial data load and date change handler
    useEffect(() => {
        if (userProfile) {
            refreshData(selectedDate);
        }
    }, [selectedDate, userProfile, refreshData]);

    // FIXED: Action completion handler with immediate refresh
    const handleActionComplete = useCallback(async (action = 'update') => {
        console.log(`🔄 Refreshing dashboard after ${action}`);
        setEditingTransaction(null);
        
        // FIXED: Force immediate refresh with new data
        await refreshData(selectedDate, true);
        
        // Show success feedback
        if (action === 'create') {
            console.log('✅ Transaction created, dashboard updated');
        } else if (action === 'update') {
            console.log('✅ Transaction updated, dashboard updated');
        } else if (action === 'delete') {
            console.log('✅ Transaction deleted, dashboard updated');
        }
    }, [refreshData, selectedDate]);

    // FIXED: Edit handler with proper state management
    const handleEditClick = useCallback((transaction) => {
        setEditingTransaction(transaction);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    // FIXED: Date change handler with immediate refresh
    const handleDateChange = useCallback(async (newDate) => {
        setSelectedDate(newDate);
        setEditingTransaction(null);
        await refreshData(newDate, true);
    }, [refreshData]);
    
    const salesTransactions = transactions.filter(t => t.type === 'sale');
    const expenseTransactions = transactions.filter(t => t.type === 'expense');

    // Show error message if there's an error
    if (error) {
        return (
            <div className="max-w-7xl mx-auto">
                <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-6 mb-8">
                    <h3 className="text-red-400 font-semibold mb-2">Error Loading Dashboard</h3>
                    <p className="text-red-300">{error}</p>
                    <button 
                        onClick={() => refreshData(selectedDate, true)}
                        className="mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-7xl mx-auto" key={refreshKey}>
            {/* FIXED: Loading Indicator */}
            {loading && (
                <div className="fixed top-4 right-4 bg-slate-800 border border-slate-700 rounded-lg p-4 z-50">
                    <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-500"></div>
                        <span className="text-slate-300 text-sm">Updating dashboard...</span>
                    </div>
                </div>
            )}

            {/* FIXED: Time Clock for non-admin users */}
            {!isAdmin && <TimeClock />}
            
            {isAdmin && (
                <>
                    {/* FIXED: Date Picker with immediate refresh */}
                    <div className="bg-gradient-to-r from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-700/50 p-6 rounded-2xl shadow-xl">
                        <div className="flex items-center justify-center space-x-4">
                            <label htmlFor="date-picker" className="font-semibold text-white flex items-center">
                                <svg className="w-5 h-5 mr-2 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                Select Date:
                            </label>
                            <input
                                type="date"
                                id="date-picker"
                                value={selectedDate}
                                onChange={(e) => handleDateChange(e.target.value)}
                                className="bg-slate-700/50 border border-slate-600/50 text-white p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 backdrop-blur-sm"
                            />
                            <button
                                onClick={() => refreshData(selectedDate, true)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl transition-colors flex items-center"
                                disabled={loading}
                            >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Refresh
                            </button>
                        </div>
                    </div>
                    
                    {/* FIXED: Dashboard Summary with proper refresh key */}
                    <DashboardSummary summary={summary} key={`summary-${refreshKey}`} />
                    
                    {/* FIXED: Real-Time Analytics Section */}
                    <ErrorBoundary>
                        <RealTimeAnalytics key={`analytics-${refreshKey}`} />
                    </ErrorBoundary>
                    
                    {/* FIXED: Approval Queue */}
                    <ErrorBoundary>
                        <ApprovalQueue onActionComplete={handleActionComplete} key={`approval-${refreshKey}`} />
                    </ErrorBoundary>
                </>
            )}

            {/* FIXED: Forms Section with proper callback handling */}
            {editingTransaction ? (
                <div className="max-w-4xl mx-auto">
                    <ErrorBoundary>
                        {editingTransaction.type === 'sale' 
                            ? <AddSaleForm 
                                transactionToEdit={editingTransaction} 
                                onUpdate={() => handleActionComplete('update')} 
                                onCancelEdit={() => setEditingTransaction(null)} 
                              />
                            : <AddExpenseForm 
                                transactionToEdit={editingTransaction} 
                                onUpdate={() => handleActionComplete('update')} 
                                onCancelEdit={() => setEditingTransaction(null)} 
                              />
                        }
                    </ErrorBoundary>
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 max-w-7xl mx-auto">
                    <div className="w-full">
                        <ErrorBoundary>
                            <AddSaleForm onNewSale={() => handleActionComplete('create')} />
                        </ErrorBoundary>
                    </div>
                    <div className="w-full">
                        <ErrorBoundary>
                            <AddExpenseForm onNewExpense={() => handleActionComplete('create')} />
                        </ErrorBoundary>
                    </div>
                </div>
            )}

            {/* FIXED: Transaction Lists with proper refresh callbacks */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 max-w-7xl mx-auto">
                <div className="w-full">
                    <ErrorBoundary>
                        <TransactionList 
                            title="Sales"
                            transactions={salesTransactions} 
                            userProfile={userProfile}
                            onEdit={handleEditClick}
                            onActionComplete={() => handleActionComplete('delete')}
                            key={`sales-${refreshKey}`}
                        />
                    </ErrorBoundary>
                </div>
                <div className="w-full">
                    <ErrorBoundary>
                        <TransactionList 
                            title="Expenses"
                            transactions={expenseTransactions} 
                            userProfile={userProfile}
                            onEdit={handleEditClick}
                            onActionComplete={() => handleActionComplete('delete')}
                            key={`expenses-${refreshKey}`}
                        />
                    </ErrorBoundary>
                </div>
            </div>
        </div>
    );
};

// FIXED: Enhanced Main App Component with Complete Error Handling and All Features
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
                    
                    {/* FIXED: Staff-accessible routes - Available to ALL authenticated users */}
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
