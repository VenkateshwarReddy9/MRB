// client/src/components/TimeClock.jsx

import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';

const TimeClock = () => {
    const [isClockedIn, setIsClockedIn] = useState(false);
    const [clockInTime, setClockInTime] = useState(null);
    const [isOnBreak, setIsOnBreak] = useState(false);
    const [breakStartTime, setBreakStartTime] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState('');

    // Update current time every second
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Calculate elapsed time properly
    const getElapsedTime = () => {
        if (!isClockedIn || !clockInTime) return '00:00:00';
        
        try {
            const clockIn = new Date(clockInTime);
            const now = new Date();
            const diff = now.getTime() - clockIn.getTime();
            
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } catch (error) {
            console.error('Error calculating elapsed time:', error);
            return '00:00:00';
        }
    };

    // Calculate break time
    const getBreakTime = () => {
        if (!isOnBreak || !breakStartTime) return '00:00:00';
        
        try {
            const breakStart = new Date(breakStartTime);
            const now = new Date();
            const diff = now.getTime() - breakStart.getTime();
            
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } catch (error) {
            console.error('Error calculating break time:', error);
            return '00:00:00';
        }
    };

    // Format clock-in time display
    const formatClockInTime = () => {
        if (!clockInTime) return '--:--:--';
        
        try {
            const clockIn = new Date(clockInTime);
            return clockIn.toLocaleTimeString('en-GB', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        } catch (error) {
            console.error('Error formatting clock-in time:', error);
            return '--:--:--';
        }
    };

    // Check the user's current status when the page loads
    const checkStatus = async () => {
        if (!auth.currentUser) {
            setLoading(false);
            return;
        }
        
        setLoading(true);
        try {
            const token = await auth.currentUser.getIdToken();
            const response = await fetch('http://localhost:5000/api/time-clock/status', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Status response:', data);
            
            if (data.clockedIn && data.currentEntry) {
                setIsClockedIn(true);
                const clockInTimestamp = data.currentEntry.clock_in_timestamp || data.currentEntry.clock_in_time;
                setClockInTime(clockInTimestamp);
                
                // Check break status
                const hasBreakStart = data.currentEntry.break_start_time;
                const hasBreakEnd = data.currentEntry.break_end_time;
                
                if (hasBreakStart && !hasBreakEnd) {
                    setIsOnBreak(true);
                    setBreakStartTime(data.currentEntry.break_start_time);
                } else {
                    setIsOnBreak(false);
                    setBreakStartTime(null);
                }
            } else {
                setIsClockedIn(false);
                setClockInTime(null);
                setIsOnBreak(false);
                setBreakStartTime(null);
            }
        } catch (error) {
            console.error("Failed to check clock-in status:", error);
            setError('Failed to load status');
            setIsClockedIn(false);
            setClockInTime(null);
            setIsOnBreak(false);
            setBreakStartTime(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkStatus();
    }, []);

    const handleClockIn = async () => {
        setActionLoading(true);
        setError('');
        
        try {
            const token = await auth.currentUser.getIdToken();
            const response = await fetch('http://localhost:5000/api/time-clock/clock-in', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({
                    notes: null,
                    location: 'Restaurant'
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('Clock-in result:', result);
                alert('Successfully clocked in!');
                await checkStatus();
            } else {
                const data = await response.json();
                setError(data.error || 'Failed to clock in');
                alert(`Error: ${data.error || 'Failed to clock in'}`);
            }
        } catch (error) {
            console.error('Clock in error:', error);
            setError('Network error occurred');
            alert('An error occurred. Please try again.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleClockOut = async () => {
        setActionLoading(true);
        setError('');
        
        try {
            const token = await auth.currentUser.getIdToken();
            const response = await fetch('http://localhost:5000/api/time-clock/clock-out', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({
                    notes: null
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('Clock-out result:', result);
                alert('Successfully clocked out!');
                await checkStatus();
            } else {
                const data = await response.json();
                setError(data.error || 'Failed to clock out');
                alert(`Error: ${data.error || 'Failed to clock out'}`);
            }
        } catch (error) {
            console.error('Clock out error:', error);
            setError('Network error occurred');
            alert('An error occurred. Please try again.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleBreakStart = async () => {
        setActionLoading(true);
        setError('');
        
        try {
            const token = await auth.currentUser.getIdToken();
            const response = await fetch('http://localhost:5000/api/time-clock/break-start', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                }
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('Break start result:', result);
                alert('Break started!');
                await checkStatus();
            } else {
                const data = await response.json();
                setError(data.error || 'Failed to start break');
                alert(`Error: ${data.error || 'Failed to start break'}`);
            }
        } catch (error) {
            console.error('Break start error:', error);
            setError('Network error occurred');
            alert('An error occurred. Please try again.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleBreakEnd = async () => {
        setActionLoading(true);
        setError('');
        
        try {
            const token = await auth.currentUser.getIdToken();
            const response = await fetch('http://localhost:5000/api/time-clock/break-end', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                }
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('Break end result:', result);
                alert('Break ended!');
                await checkStatus();
            } else {
                const data = await response.json();
                setError(data.error || 'Failed to end break');
                alert(`Error: ${data.error || 'Failed to end break'}`);
            }
        } catch (error) {
            console.error('Break end error:', error);
            setError('Network error occurred');
            alert('An error occurred. Please try again.');
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-slate-800 p-6 rounded-xl shadow-xl border border-slate-700 mb-8">
                <div className="flex items-center justify-center space-x-3">
                    <svg className="animate-spin h-6 w-6 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-lg text-slate-300 font-medium">Checking clock-in status...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-800 p-6 rounded-xl shadow-xl border border-slate-700 hover:shadow-2xl transition-all duration-300 mb-8">
            <div className="text-center">
                {/* Current Time Display */}
                <div className="mb-6">
                    <p className="text-slate-400 text-sm font-medium mb-2">Current Time</p>
                    <p className="text-3xl font-bold text-white font-mono">
                        {currentTime.toLocaleTimeString('en-GB', { hour12: false })}
                    </p>
                    <p className="text-slate-400 text-sm mt-1">
                        {currentTime.toLocaleDateString('en-GB', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                        })}
                    </p>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-3 mb-4">
                        <p className="text-red-300 text-sm">{error}</p>
                    </div>
                )}

                {isClockedIn ? (
                    <div className="space-y-6">
                        {/* Status Indicator */}
                        <div className="flex items-center justify-center space-x-3 mb-4">
                            <div className={`w-3 h-3 rounded-full ${isOnBreak ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 animate-pulse'}`}></div>
                            <span className={`font-semibold text-lg ${isOnBreak ? 'text-amber-400' : 'text-emerald-400'}`}>
                                {isOnBreak ? 'Currently On Break' : 'Currently Clocked In'}
                            </span>
                        </div>

                        {/* Clock In Time */}
                        <div className="bg-emerald-900/20 border border-emerald-500/50 rounded-lg p-4">
                            <p className="text-emerald-300 text-sm font-medium mb-1">Clocked in at</p>
                            <p className="text-2xl font-bold text-emerald-400 font-mono">
                                {formatClockInTime()}
                            </p>
                        </div>

                        {/* Break Time Display */}
                        {isOnBreak && (
                            <div className="bg-amber-900/20 border border-amber-500/50 rounded-lg p-4">
                                <p className="text-amber-300 text-sm font-medium mb-1">Break Time</p>
                                <p className="text-2xl font-bold text-amber-400 font-mono">
                                    {getBreakTime()}
                                </p>
                            </div>
                        )}

                        {/* Total Time Worked */}
                        <div className="bg-blue-900/20 border border-blue-500/50 rounded-lg p-4">
                            <p className="text-blue-300 text-sm font-medium mb-1">Time Worked</p>
                            <p className="text-3xl font-bold text-blue-400 font-mono">
                                {getElapsedTime()}
                            </p>
                        </div>

                        {/* Break Controls */}
                        <div className="flex justify-center space-x-4">
                            {!isOnBreak ? (
                                <button 
                                    onClick={handleBreakStart}
                                    disabled={actionLoading}
                                    className="bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center"
                                >
                                    {actionLoading ? (
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    ) : (
                                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h8m-9-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    )}
                                    Start Break
                                </button>
                            ) : (
                                <button 
                                    onClick={handleBreakEnd}
                                    disabled={actionLoading}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center"
                                >
                                    {actionLoading ? (
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    ) : (
                                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    )}
                                    End Break
                                </button>
                            )}
                        </div>

                        {/* Clock Out Button */}
                        <button 
                            onClick={handleClockOut} 
                            disabled={actionLoading || isOnBreak}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-8 rounded-lg text-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                        >
                            {actionLoading ? (
                                <span className="flex items-center">
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Clocking Out...
                                </span>
                            ) : (
                                <>
                                    <svg className="w-6 h-6 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                    {isOnBreak ? 'End Break First' : 'Clock Out'}
                                </>
                            )}
                        </button>

                        {isOnBreak && (
                            <p className="text-amber-300 text-sm">
                                ⚠️ You must end your break before clocking out
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Status Indicator */}
                        <div className="flex items-center justify-center space-x-3 mb-4">
                            <div className="w-3 h-3 bg-slate-500 rounded-full"></div>
                            <span className="text-slate-400 font-semibold text-lg">Currently Clocked Out</span>
                        </div>

                        {/* Message */}
                        <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4">
                            <p className="text-slate-300 text-lg">Ready to start your shift?</p>
                        </div>

                        {/* Clock In Button */}
                        <button 
                            onClick={handleClockIn} 
                            disabled={actionLoading}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 px-8 rounded-lg text-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                        >
                            {actionLoading ? (
                                <span className="flex items-center">
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Clocking In...
                                </span>
                            ) : (
                                <>
                                    <svg className="w-6 h-6 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013 3v1" />
                                    </svg>
                                    Clock In
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TimeClock;
