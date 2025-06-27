// client/src/pages/MyAvailabilityPage.jsx

import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';

const MyAvailabilityPage = () => {
    const [availability, setAvailability] = useState([]);
    const [reason, setReason] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [deletingId, setDeletingId] = useState(null);

    const user = auth.currentUser;

    const fetchAvailability = async () => {
        if (!user) return;
        setLoading(true);
        const token = await user.getIdToken();
        try {
            const response = await fetch(`${API_URL}/api/availability?user_uid=${user.uid}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch availability.');
            const data = await response.json();
            setAvailability(data.data || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchAvailability();
        }
    }, [user]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!startTime || !endTime) {
            setError('Please select both a start and end time.');
            return;
        }
        
        setSubmitting(true);
        try {
            const token = await user.getIdToken();
            const response = await fetch('${API_URL}/api/availability', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ start_time: startTime, end_time: endTime, reason })
            });
            
            if (!response.ok) throw new Error('Failed to submit request.');
            
            fetchAvailability(); // Refresh the list
            setReason(''); setStartTime(''); setEndTime('');
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (availabilityId) => {
        if (!window.confirm('Are you sure you want to delete this request?')) return;
        if (!user) return;
        
        setDeletingId(availabilityId);
        const token = await user.getIdToken();
        try {
            const response = await fetch(`${API_URL}/api/availability/${availabilityId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to delete request.');
            fetchAvailability(); // Refresh list on success
        } catch (err) {
            setError(err.message);
        } finally {
            setDeletingId(null);
        }
    };
    
    // Helper to get styling for status badges
    const getStatusClass = (status) => {
        switch (status) {
            case 'approved':
                return 'bg-emerald-100 text-emerald-800';
            case 'pending':
                return 'bg-amber-100 text-amber-800';
            case 'rejected':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-slate-100 text-slate-800';
        }
    };

    // Helper to calculate duration
    const calculateDuration = (startTime, endTime) => {
        const start = new Date(startTime);
        const end = new Date(endTime);
        const diffMs = end - start;
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
        
        if (diffDays >= 1) {
            return `${diffDays} ${diffDays === 1 ? 'day' : 'days'}`;
        } else {
            return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'}`;
        }
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="text-center">
                <h2 className="text-3xl font-bold text-white mb-2">My Availability & Time Off</h2>
                <p className="text-slate-400">Manage your time-off requests and availability</p>
            </div>
            
            {/* Request Form */}
            <div className="bg-slate-800 p-6 rounded-xl shadow-xl border border-slate-700 max-w-3xl mx-auto">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center">
                    <svg className="w-6 h-6 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Request Time Off
                </h3>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Start Date & Time</label>
                            <input 
                                type="datetime-local" 
                                value={startTime} 
                                onChange={e => setStartTime(e.target.value)} 
                                required 
                                disabled={submitting}
                                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">End Date & Time</label>
                            <input 
                                type="datetime-local" 
                                value={endTime} 
                                onChange={e => setEndTime(e.target.value)} 
                                required 
                                disabled={submitting}
                                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Reason (Optional)</label>
                        <input 
                            type="text" 
                            value={reason} 
                            onChange={e => setReason(e.target.value)} 
                            placeholder="e.g., Doctor's Appointment, Personal Day, Vacation" 
                            disabled={submitting}
                            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                    </div>
                    
                    {error && (
                        <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4">
                            <div className="flex items-center">
                                <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                                <span className="text-red-300 font-medium">{error}</span>
                            </div>
                        </div>
                    )}
                    
                    <div className="flex justify-end pt-4 border-t border-slate-700">
                        <button 
                            type="submit" 
                            disabled={submitting}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                        >
                            {submitting ? (
                                <span className="flex items-center">
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Submitting...
                                </span>
                            ) : (
                                <>
                                    <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                    </svg>
                                    Submit Request
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            {/* Requests List */}
            <div className="bg-slate-800 p-6 rounded-xl shadow-xl border border-slate-700 max-w-3xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-white flex items-center">
                        <svg className="w-6 h-6 mr-2 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Your Submitted Requests
                    </h3>
                    <span className="bg-slate-700 text-slate-300 text-sm font-bold px-3 py-1 rounded-full">
                        {availability.length} {availability.length === 1 ? 'request' : 'requests'}
                    </span>
                </div>
                
                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="flex items-center space-x-3">
                            <svg className="animate-spin h-6 w-6 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="text-slate-300 font-medium">Loading your requests...</span>
                        </div>
                    </div>
                ) : availability.length === 0 ? (
                    <div className="text-center py-12">
                        <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <h3 className="text-xl font-semibold text-slate-400 mb-2">No requests yet</h3>
                        <p className="text-slate-500">You haven't submitted any time-off requests.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {availability.map(req => (
                            <div key={req.id} className="bg-slate-700 border border-slate-600 p-5 rounded-lg hover:bg-slate-650 transition-all duration-200 shadow-lg">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-3 mb-3">
                                            <h4 className="font-semibold text-white text-lg">
                                                {req.reason || 'Time Off Request'}
                                            </h4>
                                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusClass(req.status)}`}>
                                                <span className={`w-2 h-2 rounded-full mr-2 ${
                                                    req.status === 'approved' ? 'bg-emerald-500' :
                                                    req.status === 'pending' ? 'bg-amber-500' :
                                                    req.status === 'rejected' ? 'bg-red-500' : 'bg-slate-500'
                                                }`}></span>
                                                {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                                            </span>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                                            <div className="bg-slate-800 p-3 rounded-lg">
                                                <p className="text-slate-400 text-sm font-medium mb-1">Start</p>
                                                <p className="text-white font-semibold">
                                                    {new Date(req.start_time).toLocaleDateString('en-GB', { 
                                                        weekday: 'short', 
                                                        day: 'numeric', 
                                                        month: 'short', 
                                                        year: 'numeric' 
                                                    })}
                                                </p>
                                                <p className="text-slate-300 text-sm">
                                                    {new Date(req.start_time).toLocaleTimeString('en-GB', { 
                                                        hour: '2-digit', 
                                                        minute: '2-digit' 
                                                    })}
                                                </p>
                                            </div>
                                            
                                            <div className="bg-slate-800 p-3 rounded-lg">
                                                <p className="text-slate-400 text-sm font-medium mb-1">End</p>
                                                <p className="text-white font-semibold">
                                                    {new Date(req.end_time).toLocaleDateString('en-GB', { 
                                                        weekday: 'short', 
                                                        day: 'numeric', 
                                                        month: 'short', 
                                                        year: 'numeric' 
                                                    })}
                                                </p>
                                                <p className="text-slate-300 text-sm">
                                                    {new Date(req.end_time).toLocaleTimeString('en-GB', { 
                                                        hour: '2-digit', 
                                                        minute: '2-digit' 
                                                    })}
                                                </p>
                                            </div>
                                        </div>
                                        
                                        <div className="mb-3">
                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                Duration: {calculateDuration(req.start_time, req.end_time)}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    {/* Actions */}
                                    <div className="ml-4">
                                        {req.status === 'pending' && (
                                            <button 
                                                onClick={() => handleDelete(req.id)} 
                                                disabled={deletingId === req.id}
                                                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                            >
                                                {deletingId === req.id ? (
                                                    <span className="flex items-center">
                                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                        Deleting...
                                                    </span>
                                                ) : (
                                                    <>
                                                        <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                        Delete
                                                    </>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MyAvailabilityPage;
