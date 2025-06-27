// client/src/pages/AvailabilityRequestsPage.jsx
import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const AvailabilityRequestsPage = () => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actioningId, setActioningId] = useState(null);

    const fetchPendingRequests = async () => {
        if (!auth.currentUser) return;
        setLoading(true);
        const token = await auth.currentUser.getIdToken();
        try {
            const response = await fetch(`${API_URL}/api/availability/pending`, {
                headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    }
            });
            if (!response.ok) throw new Error('Failed to fetch pending requests.');
            const data = await response.json();
            setRequests(data.data || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPendingRequests();
    }, []);

    const handleAction = async (requestId, action) => {
        const confirmText = action === 'approve'
            ? "Are you sure you want to approve this time-off request?"
            : "Are you sure you want to reject this request?";
        
        if (!window.confirm(confirmText)) return;

        setActioningId(requestId);
        const token = await auth.currentUser.getIdToken();
        try {
            const response = await fetch(`${API_URL}/api/availability/${requestId}/${action}`, {
                method: 'POST',
                headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    }
            });
            if (response.ok) {
                // On success, remove the item from the list in the UI
                setRequests(prev => prev.filter(r => r.id !== requestId));
            } else {
                const data = await response.json();
                alert(`Action failed: ${data.error}`);
            }
        } catch (err) {
            alert('An error occurred.');
        } finally {
            setActioningId(null);
        }
    };

    // Helper function to calculate duration
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

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="flex items-center space-x-3">
                    <svg className="animate-spin h-8 w-8 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-xl text-slate-300 font-medium">Loading time-off requests...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
                <h2 className="text-3xl font-bold text-white mb-2">Time Off Requests</h2>
                <p className="text-slate-400">Review and manage pending availability requests</p>
            </div>

            {/* Main Content */}
            <div className="bg-slate-800 rounded-xl shadow-xl border border-slate-700 overflow-hidden">
                {/* Header with count */}
                <div className="px-6 py-4 border-b border-slate-700 bg-slate-700/50">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-white flex items-center">
                            <svg className="w-6 h-6 mr-2 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Pending Requests
                        </h3>
                        <span className="bg-amber-500 text-amber-900 text-sm font-bold px-3 py-1 rounded-full">
                            {requests.length} {requests.length === 1 ? 'request' : 'requests'}
                        </span>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    {error && (
                        <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 mb-6">
                            <div className="flex items-center">
                                <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                                <span className="text-red-300 font-medium">{error}</span>
                            </div>
                        </div>
                    )}

                    {requests.length === 0 ? (
                        <div className="text-center py-12">
                            <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                            </svg>
                            <h3 className="text-xl font-semibold text-slate-400 mb-2">All caught up!</h3>
                            <p className="text-slate-500">There are no pending time-off requests to review.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {requests.map(req => (
                                <div key={req.id} className="bg-slate-700 border border-slate-600 p-6 rounded-lg hover:bg-slate-650 transition-all duration-200 shadow-lg">
                                    <div className="flex justify-between items-start">
                                        {/* Left side: Request details */}
                                        <div className="flex-1 min-w-0">
                                            {/* Employee info */}
                                            <div className="flex items-center mb-3">
                                                <div className="w-10 h-10 bg-slate-600 rounded-full flex items-center justify-center mr-3">
                                                    <span className="text-sm font-bold text-white">
                                                        {(req.full_name || req.email).charAt(0).toUpperCase()}
                                                    </span>
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-white text-lg">{req.full_name || req.email}</h4>
                                                    <p className="text-slate-400 text-sm">{req.email}</p>
                                                </div>
                                            </div>

                                            {/* Request details */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                                <div className="bg-slate-800 p-3 rounded-lg">
                                                    <p className="text-slate-400 text-sm font-medium mb-1">Start Date & Time</p>
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
                                                    <p className="text-slate-400 text-sm font-medium mb-1">End Date & Time</p>
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

                                            {/* Duration badge */}
                                            <div className="mb-4">
                                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                                                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    Duration: {calculateDuration(req.start_time, req.end_time)}
                                                </span>
                                            </div>

                                            {/* Reason */}
                                            <div className="bg-slate-800/50 p-3 rounded-lg">
                                                <p className="text-slate-400 text-sm font-medium mb-1">Reason</p>
                                                <p className="text-slate-300">{req.reason || 'No reason provided'}</p>
                                            </div>
                                        </div>
                                        
                                        {/* Right side: Action buttons */}
                                        <div className="flex flex-col space-y-3 ml-6">
                                            <button 
                                                onClick={() => handleAction(req.id, 'approve')} 
                                                disabled={actioningId === req.id}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                            >
                                                {actioningId === req.id ? (
                                                    <span className="flex items-center">
                                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                        Processing...
                                                    </span>
                                                ) : (
                                                    <>
                                                        <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                        Approve
                                                    </>
                                                )}
                                            </button>
                                            
                                            <button 
                                                onClick={() => handleAction(req.id, 'reject')} 
                                                disabled={actioningId === req.id}
                                                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                            >
                                                {actioningId === req.id ? 'Processing...' : (
                                                    <>
                                                        <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                        Reject
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AvailabilityRequestsPage;
