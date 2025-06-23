// client/src/pages/TimeEntriesAdminPage.jsx

import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { format, addDays, subDays, startOfWeek } from 'date-fns';

const TimeEntriesAdminPage = () => {
    const [weekStartDate, setWeekStartDate] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
    const [timeEntries, setTimeEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchTimeEntries = async (startDate) => {
            if (!auth.currentUser) return;
            setLoading(true);
            setError('');

            const endDate = addDays(startDate, 6);
            const token = await auth.currentUser.getIdToken();
            const headers = { 'Authorization': `Bearer ${token}` };
            
            try {
                const response = await fetch(`http://localhost:5000/api/time-entries?start_date=${format(startDate, 'yyyy-MM-dd')}&end_date=${format(endDate, 'yyyy-MM-dd')}`, { headers });
                if (!response.ok) throw new Error('Could not fetch time entries.');
                const data = await response.json();
                setTimeEntries(data.data || []);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchTimeEntries(weekStartDate);
    }, [weekStartDate]);

    // Helper function to calculate total hours for the week
    const getTotalHours = () => {
        return timeEntries.reduce((total, entry) => {
            return total + (parseFloat(entry.actual_hours_worked) || 0);
        }, 0);
    };

    // Helper function to get status styling
    const getStatusBadge = (isApproved, clockOutTimestamp) => {
        if (!clockOutTimestamp) {
            return { text: 'Currently Clocked In', className: 'bg-blue-100 text-blue-800' };
        }
        if (isApproved) {
            return { text: 'Approved', className: 'bg-emerald-100 text-emerald-800' };
        }
        return { text: 'Needs Review', className: 'bg-amber-100 text-amber-800' };
    };

    // Helper function to calculate duration in hours
    const calculateHours = (clockIn, clockOut) => {
        if (!clockOut) return null;
        const diffMs = new Date(clockOut) - new Date(clockIn);
        return (diffMs / (1000 * 60 * 60)).toFixed(2);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
                <h2 className="text-3xl font-bold text-white mb-2">Time Entries Management</h2>
                <p className="text-slate-400">Review and manage employee time clock entries</p>
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
                        <div className="flex items-center justify-center space-x-6 mt-2 text-sm">
                            <div className="flex items-center">
                                <svg className="w-4 h-4 mr-1 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-blue-400 font-semibold">{getTotalHours().toFixed(1)} total hours</span>
                            </div>
                            <div className="flex items-center">
                                <svg className="w-4 h-4 mr-1 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                <span className="text-emerald-400 font-semibold">{timeEntries.length} entries</span>
                            </div>
                        </div>
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

            {/* Time Entries Table */}
            <div className="bg-slate-800 rounded-xl shadow-xl border border-slate-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-700 bg-slate-700/50">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-white flex items-center">
                            <svg className="w-6 h-6 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Time Clock Entries
                        </h3>
                        <span className="bg-slate-600 text-slate-300 text-sm font-bold px-3 py-1 rounded-full">
                            Week {format(weekStartDate, 'w')} of {format(weekStartDate, 'yyyy')}
                        </span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-700/50">
                            <tr>
                                <th className="p-4 font-bold uppercase text-slate-400 tracking-wider">Employee</th>
                                <th className="p-4 font-bold uppercase text-slate-400 tracking-wider">Clock In</th>
                                <th className="p-4 font-bold uppercase text-slate-400 tracking-wider">Clock Out</th>
                                <th className="p-4 font-bold uppercase text-slate-400 tracking-wider">Hours Worked</th>
                                <th className="p-4 font-bold uppercase text-slate-400 tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="text-center p-12">
                                        <div className="flex items-center justify-center">
                                            <svg className="animate-spin h-8 w-8 text-blue-400 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            <span className="text-slate-400 text-lg">Loading time entries...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : timeEntries.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="text-center p-12">
                                        <div className="flex flex-col items-center">
                                            <svg className="w-16 h-16 text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <h3 className="text-xl font-semibold text-slate-400 mb-2">No time entries found</h3>
                                            <p className="text-slate-500">No employees clocked in during this period.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                timeEntries.map((entry, index) => {
                                    const statusBadge = getStatusBadge(entry.is_approved, entry.clock_out_timestamp);
                                    const calculatedHours = calculateHours(entry.clock_in_timestamp, entry.clock_out_timestamp);
                                    
                                    return (
                                        <tr key={entry.id} className={`border-b border-slate-700 hover:bg-slate-700/50 transition-all duration-200 ${index % 2 === 0 ? 'bg-slate-800/50' : 'bg-slate-800'}`}>
                                            <td className="p-4">
                                                <div className="flex items-center">
                                                    <div className="w-10 h-10 bg-slate-600 rounded-full flex items-center justify-center mr-3">
                                                        <span className="text-sm font-bold text-white">
                                                            {(entry.full_name || entry.email).charAt(0).toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-white">{entry.full_name || entry.email}</p>
                                                        <p className="text-slate-400 text-xs">ID: {entry.id}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="text-slate-300">
                                                    <p className="font-medium">{new Date(entry.clock_in_timestamp).toLocaleDateString('en-GB')}</p>
                                                    <p className="text-sm text-slate-400">{new Date(entry.clock_in_timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                {entry.clock_out_timestamp ? (
                                                    <div className="text-slate-300">
                                                        <p className="font-medium">{new Date(entry.clock_out_timestamp).toLocaleDateString('en-GB')}</p>
                                                        <p className="text-sm text-slate-400">{new Date(entry.clock_out_timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center">
                                                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse mr-2"></div>
                                                        <span className="text-blue-400 font-medium text-sm">Still Clocked In</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                {entry.actual_hours_worked || calculatedHours ? (
                                                    <div className="text-center">
                                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                                                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                            </svg>
                                                            {(entry.actual_hours_worked || calculatedHours)} hours
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-500 text-sm italic">In progress</span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${statusBadge.className}`}>
                                                    <span className={`w-2 h-2 rounded-full mr-2 ${
                                                        !entry.clock_out_timestamp ? 'bg-blue-500' :
                                                        entry.is_approved ? 'bg-emerald-500' : 'bg-amber-500'
                                                    }`}></span>
                                                    {statusBadge.text}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Summary Stats */}
            {!loading && timeEntries.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                        <div className="flex items-center">
                            <div className="w-2 h-8 bg-blue-500 rounded-full mr-3"></div>
                            <div>
                                <p className="text-slate-400 text-sm">Total Entries</p>
                                <p className="text-2xl font-bold text-white">{timeEntries.length}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                        <div className="flex items-center">
                            <div className="w-2 h-8 bg-emerald-500 rounded-full mr-3"></div>
                            <div>
                                <p className="text-slate-400 text-sm">Total Hours</p>
                                <p className="text-2xl font-bold text-emerald-400">{getTotalHours().toFixed(1)}h</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                        <div className="flex items-center">
                            <div className="w-2 h-8 bg-amber-500 rounded-full mr-3"></div>
                            <div>
                                <p className="text-slate-400 text-sm">Approved</p>
                                <p className="text-2xl font-bold text-amber-400">
                                    {timeEntries.filter(entry => entry.is_approved).length}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                        <div className="flex items-center">
                            <div className="w-2 h-8 bg-red-500 rounded-full mr-3"></div>
                            <div>
                                <p className="text-slate-400 text-sm">Pending Review</p>
                                <p className="text-2xl font-bold text-red-400">
                                    {timeEntries.filter(entry => !entry.is_approved && entry.clock_out_timestamp).length}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TimeEntriesAdminPage;
