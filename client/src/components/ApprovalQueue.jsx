// client/src/components/ApprovalQueue.jsx
import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';

// Now accepts an onActionComplete prop to refresh the parent dashboard
const ApprovalQueue = ({ onActionComplete }) => {
    const [requests, setRequests] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [actioningId, setActioningId] = useState(null);

    const fetchRequests = async () => {
        if (!auth.currentUser) return;
        setIsLoading(true);
        const token = await auth.currentUser.getIdToken();
        try {
                        const response = await fetch(`${API_URL}/api/approval-requests`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok) {
                setRequests(data.data || []);
            } else {
                console.error("Failed to fetch approval requests:", data.error);
            }
        } catch (error) {
            console.error("Error fetching requests:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // We can add a dependency on the onActionComplete function itself
    // to subtly hint that it can be used to trigger a refresh,
    // though the primary trigger is the user's click action.
    useEffect(() => {
        fetchRequests();
    }, []);

    const handleAction = async (transactionId, action) => {
        const confirmText = action === 'approve-delete' 
            ? "Are you sure you want to approve this deletion? The transaction will be permanently removed."
            : "Are you sure you want to reject this deletion request?";
        
        if (!window.confirm(confirmText)) return;

        setActioningId(transactionId);
        const token = await auth.currentUser.getIdToken();
        
        try {
            const response = await fetch(`${API_URL}/api/transactions/${transactionId}/${action}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                // SUCCESS: Instead of managing its own state,
                // it now tells the parent Dashboard to refresh all data.
                onActionComplete();
            } else {
                alert('Action failed. Please try again.');
            }
        } catch (error) {
            alert('An error occurred. Please try again.');
        } finally {
            setActioningId(null);
        }
    };

    if (isLoading) {
        return (
            <div className="bg-amber-900/20 border border-amber-500/50 p-6 rounded-xl shadow-xl mb-8">
                <div className="flex items-center space-x-3">
                    <svg className="animate-spin h-5 w-5 text-amber-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-amber-300 font-medium">Loading approval requests...</span>
                </div>
            </div>
        );
    }

    if (requests.length === 0) {
        return null; 
    }

    return (
        <div className="bg-amber-900/20 border border-amber-500/50 p-6 rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 mb-8">
            <div className="flex items-center mb-6">
                <div className="w-2 h-8 bg-amber-500 rounded-full mr-3"></div>
                <h3 className="text-xl font-bold text-amber-300 flex items-center">
                    Pending Deletion Requests
                    <span className="ml-3 bg-amber-500 text-amber-900 text-sm font-bold px-3 py-1 rounded-full">
                        {requests.length}
                    </span>
                </h3>
            </div>
            
            <div className="space-y-4">
                {requests.map(req => (
                    <div key={req.id} className="bg-slate-800 border border-slate-700 p-5 rounded-lg hover:bg-slate-750 transition-all duration-200 shadow-lg">
                        <div className="flex justify-between items-start">
                            <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-2">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                        req.type === 'sale' 
                                            ? 'bg-emerald-100 text-emerald-800' 
                                            : 'bg-red-100 text-red-800'
                                    }`}>
                                        {req.type === 'sale' ? 'Sale' : 'Expense'}
                                    </span>
                                    <span className="text-slate-400 text-sm">
                                        {new Date(req.transaction_date).toLocaleDateString()}
                                    </span>
                                </div>
                                
                                <p className="font-semibold text-white text-lg mb-1">
                                    {req.description}
                                </p>
                                
                                <p className={`text-2xl font-bold mb-2 ${
                                    req.type === 'sale' ? 'text-emerald-400' : 'text-red-400'
                                }`}>
                                    £{parseFloat(req.amount).toFixed(2)}
                                </p>
                                
                                <div className="flex items-center space-x-4 text-sm text-slate-400">
                                    <span>
                                        Requested by: <span className="font-medium text-slate-300">{req.user_email}</span>
                                    </span>
                                    {req.category && (
                                        <span>
                                            Category: <span className="font-medium text-slate-300">{req.category}</span>
                                        </span>
                                    )}
                                </div>
                            </div>
                            
                            <div className="flex items-center space-x-3 ml-4">
                                <button 
                                    onClick={() => handleAction(req.id, 'approve-delete')} 
                                    disabled={actioningId === req.id}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
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
                                        'Approve'
                                    )}
                                </button>
                                
                                <button 
                                    onClick={() => handleAction(req.id, 'reject-delete')} 
                                    disabled={actioningId === req.id}
                                    className="bg-slate-600 hover:bg-slate-500 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                >
                                    {actioningId === req.id ? 'Processing...' : 'Reject'}
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="mt-4 p-3 bg-amber-900/30 rounded-lg border border-amber-500/30">
                <p className="text-amber-200 text-sm flex items-center">
                    <svg className="w-4 h-4 mr-2 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    These transactions are pending deletion approval. Review carefully before taking action.
                </p>
            </div>
        </div>
    );
};

export default ApprovalQueue;
