// client/src/pages/TimesheetPage.jsx

import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { format, subDays, startOfWeek } from 'date-fns';

const TimesheetPage = () => {
    // Default to showing the report for the last 7 days
    const [endDate, setEndDate] = useState(new Date());
    const [startDate, setStartDate] = useState(subDays(new Date(), 6));
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [exporting, setExporting] = useState(false);

    const fetchTimesheetReport = async (start, end) => {
        if (!auth.currentUser) return;
        setLoading(true);
        setError('');
        const token = await auth.currentUser.getIdToken();
        const headers = { 'Authorization': `Bearer ${token}` };
        
        const startDateStr = format(start, 'yyyy-MM-dd');
        const endDateStr = format(end, 'yyyy-MM-dd');

        try {
            const response = await fetch(`http://localhost:5000/api/reports/timesheet?start_date=${startDateStr}&end_date=${endDateStr}`, { headers });
            if (!response.ok) throw new Error('Failed to fetch timesheet report.');
            const data = await response.json();
            setReportData(data.data || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTimesheetReport(startDate, endDate);
    }, [startDate, endDate]);

    const handleExport = async () => {
        setExporting(true);
        const startDateStr = format(startDate, 'yyyy-MM-dd');
        const endDateStr = format(endDate, 'yyyy-MM-dd');
        
        try {
            const token = await auth.currentUser.getIdToken();
            const exportUrl = `http://localhost:5000/api/reports/timesheet/export?start_date=${startDateStr}&end_date=${endDateStr}&token=${token}`;
            window.open(exportUrl, '_blank');
        } catch (err) {
            alert('Failed to export timesheet. Please try again.');
        } finally {
            setExporting(false);
        }
    };

    // Calculate totals
    const getTotals = () => {
        const totalHours = reportData.reduce((sum, row) => sum + parseFloat(row.total_hours || 0), 0);
        const totalPay = reportData.reduce((sum, row) => sum + parseFloat(row.total_pay || 0), 0);
        return { totalHours, totalPay };
    };

    const totals = getTotals();

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
                <h2 className="text-3xl font-bold text-white mb-2">Timesheet & Payroll Summary</h2>
                <p className="text-slate-400">Generate detailed payroll reports for any date range</p>
            </div>

            {/* Date Range & Export Controls */}
            <div className="bg-slate-800 p-6 rounded-xl shadow-xl border border-slate-700">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex flex-col md:flex-row items-center gap-4">
                        <div className="flex items-center space-x-2">
                            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <label className="text-white font-medium">Start Date:</label>
                            <input 
                                type="date" 
                                value={format(startDate, 'yyyy-MM-dd')} 
                                onChange={e => setStartDate(new Date(e.target.value))} 
                                className="bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200" 
                            />
                        </div>
                        
                        <div className="flex items-center space-x-2">
                            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <label className="text-white font-medium">End Date:</label>
                            <input 
                                type="date" 
                                value={format(endDate, 'yyyy-MM-dd')} 
                                onChange={e => setEndDate(new Date(e.target.value))} 
                                className="bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200" 
                            />
                        </div>
                    </div>
                    
                    <button 
                        onClick={handleExport}
                        disabled={exporting || loading || reportData.length === 0}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center"
                    >
                        {exporting ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Exporting...
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Export CSV
                            </>
                        )}
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

            {/* Summary Cards */}
            {!loading && reportData.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-slate-800 p-6 rounded-xl shadow-xl border border-slate-700 text-center">
                        <div className="flex items-center justify-center mb-3">
                            <div className="w-2 h-8 bg-blue-500 rounded-full mr-3"></div>
                            <h3 className="text-slate-400 text-sm font-bold uppercase tracking-wider">Total Employees</h3>
                        </div>
                        <p className="text-4xl font-bold text-white">{reportData.length}</p>
                    </div>
                    
                    <div className="bg-slate-800 p-6 rounded-xl shadow-xl border border-slate-700 text-center">
                        <div className="flex items-center justify-center mb-3">
                            <div className="w-2 h-8 bg-amber-500 rounded-full mr-3"></div>
                            <h3 className="text-slate-400 text-sm font-bold uppercase tracking-wider">Total Hours</h3>
                        </div>
                        <p className="text-4xl font-bold text-amber-400">{totals.totalHours.toFixed(1)}h</p>
                    </div>
                    
                    <div className="bg-slate-800 p-6 rounded-xl shadow-xl border border-slate-700 text-center">
                        <div className="flex items-center justify-center mb-3">
                            <div className="w-2 h-8 bg-emerald-500 rounded-full mr-3"></div>
                            <h3 className="text-slate-400 text-sm font-bold uppercase tracking-wider">Total Payroll</h3>
                        </div>
                        <p className="text-4xl font-bold text-emerald-400">£{totals.totalPay.toFixed(2)}</p>
                    </div>
                </div>
            )}

            {/* Timesheet Table */}
            <div className="bg-slate-800 rounded-xl shadow-xl border border-slate-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-700 bg-slate-700/50">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-white flex items-center">
                            <svg className="w-6 h-6 mr-2 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Payroll Report
                        </h3>
                        <span className="bg-slate-600 text-slate-300 text-sm font-bold px-3 py-1 rounded-full">
                            {format(startDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')}
                        </span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-700/50">
                            <tr>
                                <th className="p-4 font-bold uppercase text-slate-400 tracking-wider">Employee</th>
                                <th className="p-4 font-bold uppercase text-slate-400 tracking-wider">Contact</th>
                                <th className="p-4 font-bold uppercase text-slate-400 tracking-wider">Pay Rate</th>
                                <th className="p-4 font-bold uppercase text-slate-400 tracking-wider">Total Hours</th>
                                <th className="p-4 font-bold uppercase text-slate-400 tracking-wider">Total Pay</th>
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
                                            <span className="text-slate-400 text-lg">Loading payroll report...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : reportData.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="text-center p-12">
                                        <div className="flex flex-col items-center">
                                            <svg className="w-16 h-16 text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            <h3 className="text-xl font-semibold text-slate-400 mb-2">No timesheet data found</h3>
                                            <p className="text-slate-500">No employee hours recorded for the selected date range.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                reportData.map((row, index) => (
                                    <tr key={row.uid} className={`border-b border-slate-700 hover:bg-slate-700/50 transition-all duration-200 ${index % 2 === 0 ? 'bg-slate-800/50' : 'bg-slate-800'}`}>
                                        <td className="p-4">
                                            <div className="flex items-center">
                                                <div className="w-10 h-10 bg-slate-600 rounded-full flex items-center justify-center mr-3">
                                                    <span className="text-sm font-bold text-white">
                                                        {(row.full_name || row.email).charAt(0).toUpperCase()}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-white">{row.full_name || 'Name not set'}</p>
                                                    <p className="text-slate-400 text-xs">ID: {row.uid.slice(0, 8)}...</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="text-slate-300">
                                                <p className="font-medium">{row.email}</p>
                                                <p className="text-sm text-slate-400">Employee</p>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                                </svg>
                                                £{parseFloat(row.pay_rate).toFixed(2)}/hr
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800">
                                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                {parseFloat(row.total_hours).toFixed(2)}h
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-800">
                                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                                </svg>
                                                £{parseFloat(row.total_pay).toFixed(2)}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        {!loading && reportData.length > 0 && (
                            <tfoot className="bg-slate-700/50 border-t-2 border-slate-600">
                                <tr>
                                    <td colSpan="3" className="p-4 text-right font-bold text-white">TOTALS:</td>
                                    <td className="p-4">
                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-amber-200 text-amber-900">
                                            {totals.totalHours.toFixed(2)}h
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-emerald-200 text-emerald-900">
                                            £{totals.totalPay.toFixed(2)}
                                        </span>
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TimesheetPage;
