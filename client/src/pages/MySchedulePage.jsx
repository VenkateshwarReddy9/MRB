// client/src/pages/MySchedulePage.jsx

import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';
// Make sure to import 'parse' and 'addMinutes' from date-fns
import { format, addDays, subDays, startOfWeek, parse, addMinutes } from 'date-fns';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const MySchedulePage = () => {
    const [weekStartDate, setWeekStartDate] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
    const [myShifts, setMyShifts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const user = auth.currentUser;

    useEffect(() => {
        const fetchMySchedule = async (startDate) => {
            if (!user) return;
            setLoading(true);
            const endDate = addDays(startDate, 6);
            const token = await user.getIdToken();
            try {
                const response = await fetch(`${API_URL}/api/my-schedule?start_date=${format(startDate, 'yyyy-MM-dd')}&end_date=${format(endDate, 'yyyy-MM-dd')}`, {
                    headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    }
                });
                if (!response.ok) throw new Error('Could not fetch schedule.');
                const data = await response.json();
                setMyShifts(data.data || []);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchMySchedule(weekStartDate);
    }, [weekStartDate, user]);

    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStartDate, i));

    // Helper function to get shift duration
    const getShiftDuration = (shift) => {
        if (shift.duration_minutes) {
            const hours = Math.floor(shift.duration_minutes / 60);
            const minutes = shift.duration_minutes % 60;
            return `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`;
        }
        return '';
    };

    // Helper function to check if day is today
    const isToday = (date) => {
        const today = new Date();
        return format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
                <h2 className="text-3xl font-bold text-white mb-2">My Schedule</h2>
                <p className="text-slate-400">View your weekly work schedule</p>
            </div>

            {/* Week Navigation */}
            <div className="bg-slate-800 p-6 rounded-xl shadow-xl border border-slate-700">
                <div className="flex justify-between items-center">
                    <button 
                        onClick={() => setWeekStartDate(subDays(weekStartDate, 7))} 
                        className="bg-slate-600 hover:bg-slate-500 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Previous Week
                    </button>
                    
                    <div className="text-center">
                        <h3 className="text-xl text-white font-bold">
                            {format(weekStartDate, 'do MMMM yyyy')} - {format(addDays(weekStartDate, 6), 'do MMMM yyyy')}
                        </h3>
                        <p className="text-slate-400 text-sm mt-1">
                            Week {format(weekStartDate, 'w')} of {format(weekStartDate, 'yyyy')}
                        </p>
                    </div>
                    
                    <button 
                        onClick={() => setWeekStartDate(addDays(weekStartDate, 7))} 
                        className="bg-slate-600 hover:bg-slate-500 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center"
                    >
                        Next Week
                        <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-4 text-center">
                    <div className="flex items-center justify-center">
                        <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <span className="text-red-300 font-medium">{error}</span>
                    </div>
                </div>
            )}

            {/* Schedule Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
                {weekDays.map(day => {
                    const scheduledShift = myShifts.find(s => format(new Date(s.shift_date), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd'));
                    const dayIsToday = isToday(day);
                    
                    // --- THIS IS THE KEY FIX ---
                    let startTime, endTime;
                    if (scheduledShift) {
                        // Use actual times if they exist, otherwise use template times
                        startTime = scheduledShift.actual_start_time || scheduledShift.start_time;
                        
                        // If there's a custom end time, use it. Otherwise, calculate it from the duration.
                        if (scheduledShift.actual_end_time) {
                            endTime = scheduledShift.actual_end_time;
                        } else {
                            const startTimeDate = parse(scheduledShift.start_time, 'HH:mm:ss', new Date());
                            const endTimeDate = addMinutes(startTimeDate, scheduledShift.duration_minutes);
                            endTime = format(endTimeDate, 'HH:mm:ss');
                        }
                    }

                    return (
                        <div 
                            key={day.toString()} 
                            className={`bg-slate-800 rounded-xl p-4 min-h-[160px] border transition-all duration-200 hover:shadow-lg ${
                                dayIsToday 
                                    ? 'border-blue-500 shadow-lg shadow-blue-500/20' 
                                    : 'border-slate-700 hover:border-slate-600'
                            }`}
                        >
                            {/* Day Header */}
                            <div className="text-center mb-3">
                                <div className="flex items-center justify-center space-x-2">
                                    <p className={`font-bold text-lg ${dayIsToday ? 'text-blue-400' : 'text-white'}`}>
                                        {format(day, 'EEE')}
                                    </p>
                                    {dayIsToday && (
                                        <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
                                    )}
                                </div>
                                <p className={`text-sm ${dayIsToday ? 'text-blue-300' : 'text-slate-400'}`}>
                                    {format(day, 'do MMM')}
                                </p>
                            </div>
                            
                            <hr className="border-slate-600 mb-3" />
                            
                            {/* Shift Content */}
                            <div className="text-center">
                                {loading ? (
                                    <div className="flex items-center justify-center py-4">
                                        <svg className="animate-spin h-5 w-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    </div>
                                ) : scheduledShift ? (
                                    <div className={`p-3 rounded-lg ${
                                        dayIsToday 
                                            ? 'bg-blue-900/50 border border-blue-500/50' 
                                            : 'bg-emerald-900/30 border border-emerald-500/50'
                                    }`}>
                                        <div className="flex items-center justify-center mb-2">
                                            <svg className={`w-4 h-4 mr-1 ${dayIsToday ? 'text-blue-400' : 'text-emerald-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2V6" />
                                            </svg>
                                            <p className={`font-bold text-sm ${dayIsToday ? 'text-blue-200' : 'text-emerald-200'}`}>
                                                {scheduledShift.shift_name}
                                            </p>
                                        </div>
                                        
                                        {/* Now safely use the calculated start and end times */}
                                        <div className="space-y-1">
                                            <p className={`font-semibold ${dayIsToday ? 'text-blue-100' : 'text-emerald-100'}`}>
                                                {startTime.substring(0, 5)} - {endTime.substring(0, 5)}
                                            </p>
                                            
                                            {scheduledShift.duration_minutes && (
                                                <p className={`text-xs ${dayIsToday ? 'text-blue-300' : 'text-emerald-300'}`}>
                                                    {getShiftDuration(scheduledShift)}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="py-4">
                                        <div className="flex items-center justify-center mb-2">
                                            <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 12H4" />
                                            </svg>
                                        </div>
                                        <p className="text-slate-500 text-sm font-medium">Day Off</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Schedule Summary */}
            {!loading && myShifts.length > 0 && (
                <div className="bg-slate-800 p-6 rounded-xl shadow-xl border border-slate-700">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Week Summary
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-slate-700/50 p-4 rounded-lg text-center">
                            <p className="text-slate-400 text-sm font-medium">Total Shifts</p>
                            <p className="text-2xl font-bold text-white">{myShifts.length}</p>
                        </div>
                        
                        <div className="bg-slate-700/50 p-4 rounded-lg text-center">
                            <p className="text-slate-400 text-sm font-medium">Total Hours</p>
                            <p className="text-2xl font-bold text-emerald-400">
                                {Math.round(myShifts.reduce((total, shift) => total + (shift.duration_minutes || 0), 0) / 60)}h
                            </p>
                        </div>
                        
                        <div className="bg-slate-700/50 p-4 rounded-lg text-center">
                            <p className="text-slate-400 text-sm font-medium">Days Off</p>
                            <p className="text-2xl font-bold text-blue-400">{7 - myShifts.length}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MySchedulePage;
