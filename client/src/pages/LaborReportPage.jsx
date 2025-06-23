// client/src/pages/LaborReportPage.jsx

import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns';

const LaborReportPage = () => {
    const [reportData, setReportData] = useState([]);
    const [summary, setSummary] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [dateRange, setDateRange] = useState({
        start_date: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
        end_date: format(new Date(), 'yyyy-MM-dd')
    });
    const [viewMode, setViewMode] = useState('daily'); // daily or single
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

    const fetchReport = async () => {
        setLoading(true);
        setError('');
        
        try {
            const token = await auth.currentUser.getIdToken();
            let url = 'http://localhost:5000/api/reports/labor-vs-sales';
            
            if (viewMode === 'daily') {
                url += `?start_date=${dateRange.start_date}&end_date=${dateRange.end_date}`;
            } else {
                url += `?date=${selectedDate}`;
            }
            
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch report');
            }
            
            const data = await response.json();
            setReportData(data.data);
            setSummary(data.summary);
        } catch (err) {
            console.error('Report fetch error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, [dateRange, selectedDate, viewMode]);

    const handleDateRangeChange = (field, value) => {
        setDateRange(prev => ({ ...prev, [field]: value }));
    };

    const handleQuickDateRange = (days) => {
        const endDate = new Date();
        const startDate = subDays(endDate, days);
        setDateRange({
            start_date: format(startDate, 'yyyy-MM-dd'),
            end_date: format(endDate, 'yyyy-MM-dd')
        });
    };

    const handleExport = async () => {
        try {
            const token = await auth.currentUser.getIdToken();
            const url = `http://localhost:5000/api/reports/labor-vs-sales/export?start_date=${dateRange.start_date}&end_date=${dateRange.end_date}&format=csv`;
            
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                const blob = await response.blob();
                const downloadUrl = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.download = `labor_vs_sales_${dateRange.start_date}_to_${dateRange.end_date}.csv`;
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(downloadUrl);
            } else {
                throw new Error('Export failed');
            }
        } catch (err) {
            setError('Failed to export report');
        }
    };

    const formatCurrency = (amount) => `£${parseFloat(amount).toFixed(2)}`;
    const formatPercentage = (percentage) => `${parseFloat(percentage).toFixed(1)}%`;
    const formatHours = (hours) => `${parseFloat(hours).toFixed(1)}h`;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
                <h2 className="text-3xl font-bold text-white mb-2">Labor vs Sales Report</h2>
                <p className="text-slate-400">Analyze labor costs as a percentage of sales revenue</p>
            </div>

            {/* Controls */}
            <div className="bg-slate-800 p-6 rounded-xl shadow-xl border border-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    {/* View Mode Toggle */}
                    <div className="flex bg-slate-700 rounded-lg p-1">
                        <button
                            onClick={() => setViewMode('daily')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                                viewMode === 'daily' 
                                    ? 'bg-blue-600 text-white' 
                                    : 'text-slate-300 hover:text-white'
                            }`}
                        >
                            Daily Range
                        </button>
                        <button
                            onClick={() => setViewMode('single')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                                viewMode === 'single' 
                                    ? 'bg-blue-600 text-white' 
                                    : 'text-slate-300 hover:text-white'
                            }`}
                        >
                            Single Day
                        </button>
                    </div>

                    {/* Date Controls */}
                    {viewMode === 'daily' ? (
                        <div className="flex items-center space-x-4">
                            {/* Quick Date Buttons */}
                            <div className="flex space-x-2">
                                <button
                                    onClick={() => handleQuickDateRange(7)}
                                    className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-white text-sm rounded"
                                >
                                    Last 7 Days
                                </button>
                                <button
                                    onClick={() => handleQuickDateRange(30)}
                                    className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-white text-sm rounded"
                                >
                                    Last 30 Days
                                </button>
                            </div>
                            
                            {/* Date Range Inputs */}
                            <div className="flex items-center space-x-2">
                                <input
                                    type="date"
                                    value={dateRange.start_date}
                                    onChange={(e) => handleDateRangeChange('start_date', e.target.value)}
                                    className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                                />
                                <span className="text-slate-400">to</span>
                                <input
                                    type="date"
                                    value={dateRange.end_date}
                                    onChange={(e) => handleDateRangeChange('end_date', e.target.value)}
                                    className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                                />
                            </div>
                        </div>
                    ) : (
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                        />
                    )}

                    {/* Export Button */}
                    <button
                        onClick={handleExport}
                        disabled={loading || reportData.length === 0}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-4">
                    <div className="flex items-center">
                        <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <span className="text-red-300 font-medium">{error}</span>
                    </div>
                </div>
            )}

            {/* Summary Cards */}
            {summary && Object.keys(summary).length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                        <div className="flex items-center">
                            <div className="p-2 bg-emerald-500/20 rounded-lg">
                                <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                </svg>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-slate-400">Total Sales</p>
                                <p className="text-2xl font-bold text-white">{formatCurrency(summary.total_sales)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                        <div className="flex items-center">
                            <div className="p-2 bg-blue-500/20 rounded-lg">
                                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-slate-400">Labor Hours</p>
                                <p className="text-2xl font-bold text-white">{formatHours(summary.total_labor_hours)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                        <div className="flex items-center">
                            <div className="p-2 bg-amber-500/20 rounded-lg">
                                <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-slate-400">Labor Cost</p>
                                <p className="text-2xl font-bold text-white">{formatCurrency(summary.total_labor_cost)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                        <div className="flex items-center">
                            <div className="p-2 bg-purple-500/20 rounded-lg">
                                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2-2V7a2 2 0 012-2h2a2 2 0 002 2v2a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 00-2 2v6a2 2 0 01-2 2H9z" />
                                </svg>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-slate-400">Labor %</p>
                                <p className="text-2xl font-bold text-white">{formatPercentage(summary.average_labor_percentage)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Data Table */}
            <div className="bg-slate-800 rounded-xl shadow-xl border border-slate-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-700">
                    <h3 className="text-lg font-semibold text-white">Daily Breakdown</h3>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <svg className="animate-spin h-8 w-8 text-blue-400 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="text-slate-400 text-lg">Loading report data...</span>
                    </div>
                ) : reportData.length === 0 ? (
                    <div className="text-center py-12">
                        <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <h3 className="text-xl font-bold text-slate-400 mb-2">No Data Available</h3>
                        <p className="text-slate-500">No sales or labor data found for the selected period.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-700/50">
                                <tr>
                                    <th className="p-4 font-bold uppercase text-slate-400">Date</th>
                                    <th className="p-4 font-bold uppercase text-slate-400">Sales</th>
                                    <th className="p-4 font-bold uppercase text-slate-400">Labor Hours</th>
                                    <th className="p-4 font-bold uppercase text-slate-400">Labor Cost</th>
                                    <th className="p-4 font-bold uppercase text-slate-400">Labor %</th>
                                    <th className="p-4 font-bold uppercase text-slate-400">Sales/Hour</th>
                                    <th className="p-4 font-bold uppercase text-slate-400">Employees</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportData.map((row, index) => (
                                    <tr key={row.date} className={`border-b border-slate-700 ${index % 2 === 0 ? 'bg-slate-800/50' : 'bg-slate-800'}`}>
                                        <td className="p-4 text-white font-medium">
                                            {format(new Date(row.date), 'MMM dd, yyyy')}
                                        </td>
                                        <td className="p-4 text-white">
                                            {formatCurrency(row.sales)}
                                        </td>
                                        <td className="p-4 text-white">
                                            {formatHours(row.labor_hours)}
                                        </td>
                                        <td className="p-4 text-white">
                                            {formatCurrency(row.labor_cost)}
                                        </td>
                                        <td className="p-4">
                                            <span className={`font-semibold ${
                                                row.labor_cost_percentage > 30 ? 'text-red-400' :
                                                row.labor_cost_percentage > 25 ? 'text-amber-400' :
                                                'text-emerald-400'
                                            }`}>
                                                {formatPercentage(row.labor_cost_percentage)}
                                            </span>
                                        </td>
                                        <td className="p-4 text-white">
                                            {formatCurrency(row.sales_per_hour)}
                                        </td>
                                        <td className="p-4 text-slate-300">
                                            {row.employees_worked}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LaborReportPage;
