// client/src/components/TransactionList.jsx

import React, { useState } from 'react';
import { auth } from '../firebase';

const TransactionList = ({ title, transactions, userProfile, onEdit, onActionComplete }) => {
    const [actioningId, setActioningId] = useState(null);

    const handleRequestDelete = async (transactionId) => {
        if (!window.confirm("Are you sure you want to request deletion for this item?")) return;
        
        const user = auth.currentUser;
        if (!user) return;

        setActioningId(transactionId);
        try {
            const token = await user.getIdToken();
            const response = await fetch(`${API_URL}/${transactionId}/request-delete`, {
                method: 'POST',
                headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    }
            });
            const data = await response.json();

            if (response.ok) {
                alert("Success: " + data.message);
                onActionComplete(); // Tell the dashboard to refresh its data
            } else {
                alert("Error: " + (data.error || "Could not submit request."));
            }
        } catch (error) {
            alert("An error occurred while submitting the request.");
        } finally {
            setActioningId(null);
        }
    };

    const handleAdminDelete = async (transactionId) => {
  if (!window.confirm("ADMIN ACTION: Permanently delete this transaction? This cannot be undone.")) return;

  const user = auth.currentUser;
  if (!user) return;

  setActioningId(transactionId);
  try {
    const token = await user.getIdToken();
    const response = await fetch(
      `${API_URL}/api/transactions/${transactionId}`,
      {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );
    const data = await response.json();

    if (response.ok) {
      alert(data.message);
      onActionComplete();
    } else {
      alert("Error: " + (data.error || "Could not delete transaction."));
    }
  } catch (error) {
    alert("An error occurred while deleting.");
  } finally {
    setActioningId(null);
  }
};

    if (!transactions || transactions.length === 0) {
        return (
            <div className="bg-slate-800 p-6 rounded-xl shadow-xl border border-slate-700 text-center">
                <div className="flex items-center justify-center mb-4">
                    <div className={`w-2 h-8 ${title === 'Sales' ? 'bg-emerald-500' : 'bg-red-500'} rounded-full mr-3`}></div>
                    <h3 className="text-xl font-bold text-white">{title}</h3>
                </div>
                <div className="py-8">
                    <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-slate-400 text-lg">No {title.toLowerCase()} recorded for this day.</p>
                    <p className="text-slate-500 text-sm mt-2">Transactions will appear here once added.</p>
                </div>
            </div>
        );
    }

    const isAdmin = userProfile.role.includes('admin');

    return (
        <div className="bg-slate-800 p-6 rounded-xl shadow-xl border border-slate-700 hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                    <div className={`w-2 h-8 ${title === 'Sales' ? 'bg-emerald-500' : 'bg-red-500'} rounded-full mr-3`}></div>
                    <h3 className="text-xl font-bold text-white">{title}</h3>
                    <span className="ml-3 bg-slate-700 text-slate-300 text-sm font-bold px-3 py-1 rounded-full">
                        {transactions.length}
                    </span>
                </div>
                <div className="text-right">
                    <p className="text-slate-400 text-sm">Total Amount</p>
                    <p className={`text-2xl font-bold ${title === 'Sales' ? 'text-emerald-400' : 'text-red-400'}`}>
                        £{transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0).toFixed(2)}
                    </p>
                </div>
            </div>
            
            <div className="space-y-3 max-h-96 overflow-y-auto">
                {transactions.map(t => (
                    <div key={t.id} className="bg-slate-700 border border-slate-600 p-4 rounded-lg hover:bg-slate-600 transition-all duration-200 shadow-lg">
                        <div className="flex justify-between items-start">
                            {/* Left side: Description and Metadata */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2 mb-2">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                        t.type === 'sale' 
                                            ? 'bg-emerald-100 text-emerald-800' 
                                            : 'bg-red-100 text-red-800'
                                    }`}>
                                        {t.type === 'sale' ? 'Sale' : 'Expense'}
                                    </span>
                                    {t.category && (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-600 text-slate-200">
                                            {t.category}
                                        </span>
                                    )}
                                </div>
                                
                                <h4 className="font-semibold text-white text-lg mb-1 truncate">{t.description}</h4>
                                
                                <div className="flex flex-col space-y-1 text-sm text-slate-400">
                                    <span className="flex items-center">
                                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        {new Date(t.transaction_date).toLocaleDateString('en-GB')} at {new Date(t.transaction_date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    {isAdmin && t.user_email && (
                                        <span className="flex items-center">
                                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                            Added by: <span className="font-medium text-slate-300">{t.user_email}</span>
                                        </span>
                                    )}
                                </div>
                            </div>
                            
                            {/* Right side: Amount and Actions */}
                            <div className="flex flex-col items-end space-y-3 ml-4">
                                <div className="text-right">
                                    <p className={`text-3xl font-bold ${t.type === 'sale' ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {t.type === 'sale' ? '+' : '-'}£{parseFloat(t.amount).toFixed(2)}
                                    </p>
                                </div>
                                
                                <div className="flex items-center space-x-2">
                                    {t.status === 'pending_delete' && (
                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                            Pending Deletion
                                        </span>
                                    )}

                                    {t.status === 'approved' && (
                                        <div className="flex space-x-2">
                                            {isAdmin ? (
                                                <>
                                                    <button 
                                                        onClick={() => onEdit(t)} 
                                                        disabled={actioningId === t.id}
                                                        className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 px-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                                    >
                                                        <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                        </svg>
                                                        Edit
                                                    </button>
                                                    <button 
                                                        onClick={() => handleAdminDelete(t.id)} 
                                                        disabled={actioningId === t.id}
                                                        className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2 px-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                                    >
                                                        {actioningId === t.id ? (
                                                            <span className="flex items-center">
                                                                <svg className="animate-spin -ml-1 mr-1 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
                                                </>
                                            ) : (
                                                <button 
                                                    onClick={() => handleRequestDelete(t.id)} 
                                                    disabled={actioningId === t.id}
                                                    className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold py-2 px-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                                >
                                                    {actioningId === t.id ? (
                                                        <span className="flex items-center">
                                                            <svg className="animate-spin -ml-1 mr-1 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                            </svg>
                                                            Requesting...
                                                        </span>
                                                    ) : (
                                                        <>
                                                            <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                                            </svg>
                                                            Request Deletion
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TransactionList;
