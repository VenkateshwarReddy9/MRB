// client/src/components/RealTimeAnalytics.jsx
import React, { useState, useEffect } from 'react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useRealTimeAnalytics } from '../hooks/useRealTimeAnalytics';

const RealTimeAnalytics = () => {
    const { metrics, forecast, peakHours, connected, loading, error } = useRealTimeAnalytics();
    const [selectedTimeframe, setSelectedTimeframe] = useState('today');

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
                <span className="ml-3 text-slate-400">Loading real-time analytics...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-6">
                <h3 className="text-red-400 font-semibold mb-2">Analytics Error</h3>
                <p className="text-red-300">{error}</p>
            </div>
        );
    }

    const connectionStatus = connected ? 'Connected' : 'Disconnected';
    const connectionColor = connected ? 'text-emerald-400' : 'text-red-400';

    // Prepare chart data
    const salesTrendData = forecast?.forecast?.map(item => ({
        hour: `${item.hour}:00`,
        predicted: item.predictedAmount,
        confidence: item.confidence
    })) || [];

    const peakHoursData = peakHours?.allHours?.map(item => ({
        hour: `${item.hour}:00`,
        transactions: item.transactionCount,
        amount: item.totalAmount
    })) || [];

    const profitData = [
        { name: 'Sales', value: parseFloat(metrics?.total_sales_amount || 0), color: '#10b981' },
        { name: 'Expenses', value: parseFloat(metrics?.total_expenses_amount || 0), color: '#ef4444' }
    ];

    return (
        <div className="space-y-8">
            {/* Header with Connection Status */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold text-white mb-2">Real-Time Analytics</h2>
                    <p className="text-slate-400">Live dashboard with predictive insights</p>
                </div>
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'} animate-pulse`}></div>
                        <span className={`text-sm font-medium ${connectionColor}`}>{connectionStatus}</span>
                    </div>
                    <div className="text-xs text-slate-500">
                        Last updated: {metrics?.timestamp ? new Date(metrics.timestamp).toLocaleTimeString() : 'Never'}
                    </div>
                </div>
            </div>

            {/* Real-Time Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Total Sales */}
                <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 backdrop-blur-sm border border-emerald-500/20 rounded-2xl p-6 hover:border-emerald-400/40 transition-all duration-300">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-emerald-400 text-sm font-medium">Total Sales</h3>
                        <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <p className="text-3xl font-bold text-white">£{parseFloat(metrics?.total_sales_amount || 0).toFixed(2)}</p>
                        <p className="text-xs text-slate-400">{metrics?.total_sales_count || 0} transactions</p>
                        <div className="flex items-center text-xs text-emerald-400">
                            <span>Avg: £{parseFloat(metrics?.avg_sale_amount || 0).toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                {/* Sales Velocity */}
                <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 backdrop-blur-sm border border-blue-500/20 rounded-2xl p-6 hover:border-blue-400/40 transition-all duration-300">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-blue-400 text-sm font-medium">Sales Velocity</h3>
                        <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <p className="text-3xl font-bold text-white">{parseFloat(metrics?.salesVelocity || 0).toFixed(1)}</p>
                        <p className="text-xs text-slate-400">sales per 15min</p>
                        <div className="flex items-center text-xs text-blue-400">
                            <span>Last hour: {metrics?.sales_last_hour || 0}</span>
                        </div>
                    </div>
                </div>

                {/* Profit */}
                <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 backdrop-blur-sm border border-purple-500/20 rounded-2xl p-6 hover:border-purple-400/40 transition-all duration-300">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-purple-400 text-sm font-medium">Today's Profit</h3>
                        <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                            </svg>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <p className={`text-3xl font-bold ${parseFloat(metrics?.profit || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            £{parseFloat(metrics?.profit || 0).toFixed(2)}
                        </p>
                        <p className="text-xs text-slate-400">
                            Margin: {metrics?.total_sales_amount ? ((parseFloat(metrics.profit) / parseFloat(metrics.total_sales_amount)) * 100).toFixed(1) : 0}%
                        </p>
                    </div>
                </div>

                {/* Peak Performance */}
                <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 backdrop-blur-sm border border-orange-500/20 rounded-2xl p-6 hover:border-orange-400/40 transition-all duration-300">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-orange-400 text-sm font-medium">Peak Sale</h3>
                        <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                            </svg>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <p className="text-3xl font-bold text-white">£{parseFloat(metrics?.max_sale_amount || 0).toFixed(2)}</p>
                        <p className="text-xs text-slate-400">highest transaction</p>
                        <div className="flex items-center text-xs text-orange-400">
                            <span>Recent: {metrics?.sales_last_15min || 0} sales</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Sales Forecast Chart */}
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
                    <h3 className="text-xl font-semibold text-white mb-6">Sales Forecast</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={salesTrendData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="hour" stroke="#9ca3af" />
                            <YAxis stroke="#9ca3af" />
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: '#1f2937', 
                                    border: '1px solid #374151',
                                    borderRadius: '8px'
                                }}
                            />
                            <Area 
                                type="monotone" 
                                dataKey="predicted" 
                                stroke="#10b981" 
                                fill="url(#colorSales)"
                                strokeWidth={2}
                            />
                            <defs>
                                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                        </AreaChart>
                    </ResponsiveContainer>
                    <div className="mt-4 flex items-center justify-between text-sm">
                        <span className="text-slate-400">Confidence: {forecast?.confidence || 'Low'}</span>
                        <span className="text-emerald-400">Next hour prediction</span>
                    </div>
                </div>

                {/* Peak Hours Analysis */}
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
                    <h3 className="text-xl font-semibold text-white mb-6">Peak Hours Analysis</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={peakHoursData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="hour" stroke="#9ca3af" />
                            <YAxis stroke="#9ca3af" />
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: '#1f2937', 
                                    border: '1px solid #374151',
                                    borderRadius: '8px'
                                }}
                            />
                            <Bar dataKey="transactions" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-4 text-sm text-slate-400">
                        Based on 30-day historical data
                    </div>
                </div>
            </div>

            {/* Sales vs Expenses Pie Chart */}
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
                <h3 className="text-xl font-semibold text-white mb-6">Today's Financial Breakdown</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={profitData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={120}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {profitData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: '#1f2937', 
                                    border: '1px solid #374151',
                                    borderRadius: '8px'
                                }}
                                formatter={(value) => [`£${value.toFixed(2)}`, '']}
                            />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                    
                    <div className="flex flex-col justify-center space-y-4">
                        <div className="flex items-center justify-between p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                            <span className="text-emerald-400 font-medium">Total Sales</span>
                            <span className="text-white font-bold">£{parseFloat(metrics?.total_sales_amount || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-red-500/10 rounded-lg border border-red-500/20">
                            <span className="text-red-400 font-medium">Total Expenses</span>
                            <span className="text-white font-bold">£{parseFloat(metrics?.total_expenses_amount || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
                            <span className="text-purple-400 font-medium">Net Profit</span>
                            <span className={`font-bold ${parseFloat(metrics?.profit || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                £{parseFloat(metrics?.profit || 0).toFixed(2)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RealTimeAnalytics;
