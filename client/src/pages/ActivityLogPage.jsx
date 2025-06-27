// client/src/pages/ActivityLogPage.jsx

import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';

const ActivityLogPage = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchLogs = async () => {
            if (!auth.currentUser) {
                setLoading(false);
                return;
            }
            try {
                const token = await auth.currentUser.getIdToken();
                const response = await fetch('${API_URL}/api/activity-logs', {
                    headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    }
                });
                if (!response.ok) throw new Error('Could not fetch activity logs.');
                const data = await response.json();
                setLogs(data.data || []);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, []);

    // --- NEW: Helper function to make actions look nice ---
    const getActionStyle = (actionType) => {
        switch (actionType) {
            case 'CREATE_SALE':
            case 'CREATE_EXPENSE':
            case 'CREATE_USER':
                return { 
                    text: 'Create', 
                    className: 'bg-emerald-100 text-emerald-800',
                    icon: '+'
                };
            case 'UPDATE_TRANSACTION':
                return { 
                    text: 'Update', 
                    className: 'bg-amber-100 text-amber-800',
                    icon: '✏️'
                };
            case 'ADMIN_DELETE_TRANSACTION':
            case 'APPROVE_DELETION':
            case 'DISABLE_USER':
                return { 
                    text: 'Delete / Disable', 
                    className: 'bg-red-100 text-red-800',
                    icon: '🗑️'
                };
            case 'REJECT_DELETION':
            case 'REQUEST_DELETION':
                return { 
                    text: 'Review', 
                    className: 'bg-blue-100 text-blue-800',
                    icon: '👁️'
                };
            case 'PROMOTE_ADMIN':
                return { 
                    text: 'Promotion', 
                    className: 'bg-purple-100 text-purple-800',
                    icon: '⬆️'
                };
            default:
                return { 
                    text: actionType.replace('_', ' '), 
                    className: 'bg-slate-100 text-slate-800',
                    icon: '📝'
                };
        }
    };

    // Filter logs based on search term and filter
    const filteredLogs = logs.filter(log => {
        const matchesSearch = searchTerm === '' || 
            log.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.action_type.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesFilter = filter === 'all' || log.action_type.includes(filter.toUpperCase());
        
        return matchesSearch && matchesFilter;
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="flex items-center space-x-3">
                    <svg className="animate-spin h-8 w-8 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-xl text-slate-300 font-medium">Loading activity log...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-6 text-center">
                <svg className="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-xl font-bold text-red-400 mb-2">Error Loading Activity Log</h3>
                <p className="text-red-300">{error}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
                <h2 className="text-3xl font-bold text-white mb-2">Activity Log</h2>
                <p className="text-slate-400">Track all system activities and user actions</p>
            </div>

            {/* Filters and Search */}
            <div className="bg-slate-800 p-6 rounded-xl shadow-xl border border-slate-700">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-slate-300 mb-2">Search</label>
                        <input
                            type="text"
                            placeholder="Search by user, action, or details..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                        />
                    </div>
                    <div className="md:w-48">
                        <label className="block text-sm font-medium text-slate-300 mb-2">Filter by Action</label>
                        <select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                        >
                            <option value="all">All Actions</option>
                            <option value="create">Create Actions</option>
                            <option value="update">Update Actions</option>
                            <option value="delete">Delete Actions</option>
                            <option value="admin">Admin Actions</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Activity Log Table */}
            <div className="bg-slate-800 rounded-xl shadow-xl border border-slate-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-700">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
                        <span className="bg-slate-700 text-slate-300 text-sm font-bold px-3 py-1 rounded-full">
                            {filteredLogs.length} {filteredLogs.length === 1 ? 'entry' : 'entries'}
                        </span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-700/50">
                            <tr>
                                <th className="p-4 font-bold uppercase text-slate-400 tracking-wider">Timestamp</th>
                                <th className="p-4 font-bold uppercase text-slate-400 tracking-wider">User</th>
                                <th className="p-4 font-bold uppercase text-slate-400 tracking-wider">Action</th>
                                <th className="p-4 font-bold uppercase text-slate-400 tracking-wider">Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="text-center p-12">
                                        <div className="flex flex-col items-center">
                                            <svg className="w-16 h-16 text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            <p className="text-slate-400 text-lg font-medium">No activity found</p>
                                            <p className="text-slate-500 text-sm mt-1">
                                                {searchTerm || filter !== 'all' ? 'Try adjusting your search or filter criteria.' : 'No activity has been logged yet.'}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.map((log, index) => {
                                    const actionStyle = getActionStyle(log.action_type);
                                    return (
                                        <tr key={log.id} className={`border-b border-slate-700 hover:bg-slate-700/50 transition-all duration-200 ${index % 2 === 0 ? 'bg-slate-800/50' : 'bg-slate-800'}`}>
                                            <td className="p-4 text-slate-300 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{new Date(log.timestamp).toLocaleDateString('en-GB')}</span>
                                                    <span className="text-sm text-slate-400">{new Date(log.timestamp).toLocaleTimeString('en-GB')}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-slate-300 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center mr-3">
                                                        <span className="text-xs font-bold text-white">
                                                            {log.user_email.charAt(0).toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <span className="font-medium">{log.user_email}</span>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${actionStyle.className}`}>
                                                    <span className="mr-1">{actionStyle.icon}</span>
                                                    {actionStyle.text}
                                                </span>
                                            </td>
                                            <td className="p-4 text-slate-300 max-w-md">
                                                <div className="break-words">{log.details}</div>
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
            {logs.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                        <div className="flex items-center">
                            <div className="w-2 h-8 bg-blue-500 rounded-full mr-3"></div>
                            <div>
                                <p className="text-slate-400 text-sm">Total Entries</p>
                                <p className="text-2xl font-bold text-white">{logs.length}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                        <div className="flex items-center">
                            <div className="w-2 h-8 bg-emerald-500 rounded-full mr-3"></div>
                            <div>
                                <p className="text-slate-400 text-sm">Create Actions</p>
                                <p className="text-2xl font-bold text-emerald-400">
                                    {logs.filter(log => log.action_type.includes('CREATE')).length}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                        <div className="flex items-center">
                            <div className="w-2 h-8 bg-amber-500 rounded-full mr-3"></div>
                            <div>
                                <p className="text-slate-400 text-sm">Update Actions</p>
                                <p className="text-2xl font-bold text-amber-400">
                                    {logs.filter(log => log.action_type.includes('UPDATE')).length}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                        <div className="flex items-center">
                            <div className="w-2 h-8 bg-red-500 rounded-full mr-3"></div>
                            <div>
                                <p className="text-slate-400 text-sm">Delete Actions</p>
                                <p className="text-2xl font-bold text-red-400">
                                    {logs.filter(log => log.action_type.includes('DELETE')).length}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ActivityLogPage;
