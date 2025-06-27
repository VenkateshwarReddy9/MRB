// client/src/components/AddSaleForm.jsx

import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';

const API_BASE_URL = import.meta.env.VITE_API_URL ;

const AddSaleForm = ({ onNewSale, transactionToEdit, onUpdate, onCancelEdit }) => {
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('Dine-In'); 
    const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);
    const [editReason, setEditReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const saleCategories = ['Dine-In', 'Takeout', 'Delivery App', 'Beverages', 'Other'];
    const isEditMode = Boolean(transactionToEdit);

    useEffect(() => {
        if (isEditMode) {
            setDescription(transactionToEdit.description);
            setAmount(parseFloat(transactionToEdit.amount).toString());
            setCategory(transactionToEdit.category || 'Other');
            setTransactionDate(new Date(transactionToEdit.transaction_date).toISOString().split('T')[0]);
        }
    }, [transactionToEdit, isEditMode]);

    const resetForm = () => {
        setDescription('');
        setAmount('');
        setCategory('Dine-In');
        setTransactionDate(new Date().toISOString().split('T')[0]);
        setEditReason('');
        setError('');
    };

    const handleCancel = () => {
        if (onCancelEdit && typeof onCancelEdit === 'function') {
            onCancelEdit();
        }
        resetForm();
    };

    const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); // Clear previous errors
    
    const user = auth.currentUser;
    
    if (!user) {
        setError("You must be logged in to add a sale.");
        return;
    }
    
    // Enhanced validation
    if (!description.trim()) {
        setError("Please enter a description.");
        return;
    }
    
    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
        setError("Please enter a valid amount greater than 0.");
        return;
    }
    
    if (isEditMode && !editReason.trim()) {
        setError("Please provide a reason for the edit.");
        return;
    }

    setIsSubmitting(true);

    try {
        const token = await user.getIdToken(true); // Force refresh token
        
        const saleData = {
            description: description.trim(),
            amount: parsedAmount, // Ensure it's a number
            transaction_date: transactionDate,
            type: 'sale',
            category: category || 'Other',
            ...(isEditMode && { reason: editReason.trim() })
        };
        
        console.log('Submitting data:', saleData); // Debug log
        
        const endpoint = isEditMode 
            ? `${API_BASE_URL}/api/transactions/${transactionToEdit.id}` 
            : `${API_BASE_URL}/api/transactions`;
        const method = isEditMode ? 'PUT' : 'POST';

        const response = await fetch(endpoint, {
            method,
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify(saleData)
        });

        const responseText = await response.text();
        console.log('Raw response:', responseText); // Debug log
        
        if (!response.ok) {
            let errorData;
            try {
                errorData = JSON.parse(responseText);
            } catch {
                errorData = { error: `Server error: ${response.status}` };
            }
            console.error('Server Error:', errorData);
            setError(errorData.error || `Server returned ${response.status}`);
            return;
        }

        const result = JSON.parse(responseText);
        console.log('Success result:', result);
        
        if (isEditMode && onUpdate) {
            onUpdate(result.data);
            handleCancel();
        } else {
            resetForm();
            if (onNewSale) {
                onNewSale(result.data);
            }
        }

    } catch (error) {
        console.error('Network Error:', error);
        setError('Network error occurred. Please check your connection and try again.');
    } finally {
        setIsSubmitting(false);
    }
};


    return (
        <div className="bg-slate-800 p-6 rounded-xl shadow-xl border border-slate-700 hover:shadow-2xl transition-all duration-300 mb-8">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center">
                <span className="w-2 h-8 bg-emerald-500 rounded-full mr-3"></span>
                {isEditMode ? 'Edit Sale' : 'Add New Sale'}
            </h3>
            
            {error && (
                <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 mb-6">
                    <p className="text-red-300 text-sm">{error}</p>
                </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                        <input 
                            type="text" 
                            value={description} 
                            onChange={(e) => setDescription(e.target.value)} 
                            placeholder="Enter sale description" 
                            required 
                            disabled={isSubmitting} 
                            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed" 
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Amount (£)</label>
                        <input 
                            type="number" 
                            step="0.01" 
                            min="0.01" 
                            value={amount} 
                            onChange={(e) => setAmount(e.target.value)} 
                            placeholder="0.00" 
                            required 
                            disabled={isSubmitting} 
                            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed" 
                        />
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Date</label>
                        <input 
                            type="date" 
                            value={transactionDate} 
                            onChange={(e) => setTransactionDate(e.target.value)} 
                            required 
                            disabled={isSubmitting} 
                            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed" 
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Category</label>
                        <select 
                            value={category} 
                            onChange={(e) => setCategory(e.target.value)} 
                            disabled={isSubmitting} 
                            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saleCategories.map(cat => (
                                <option key={cat} value={cat} className="bg-slate-700 text-white">{cat}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {isEditMode && (
                    <div className="bg-amber-900/20 border border-amber-500/50 rounded-lg p-4">
                        <label className="block text-sm font-medium text-amber-300 mb-2">
                            Reason for Edit (Required)
                        </label>
                        <input 
                            type="text" 
                            value={editReason} 
                            onChange={(e) => setEditReason(e.target.value)} 
                            placeholder="Please explain why you're editing this sale" 
                            required 
                            disabled={isSubmitting} 
                            className="w-full px-4 py-3 bg-amber-900/30 border border-amber-500/50 rounded-lg text-white placeholder-amber-400/70 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed" 
                        />
                    </div>
                )}

                <div className="flex justify-end space-x-4 pt-4 border-t border-slate-700">
                    {isEditMode && (
                        <button 
                            type="button" 
                            onClick={handleCancel} 
                            disabled={isSubmitting} 
                            className="bg-slate-600 hover:bg-slate-500 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                        >
                            Cancel
                        </button>
                    )}
                    <button 
                        type="submit" 
                        disabled={isSubmitting} 
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-lg disabled:bg-slate-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:transform-none disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? (
                            <span className="flex items-center">
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Saving...
                            </span>
                        ) : (isEditMode ? 'Save Changes' : 'Add Sale')}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AddSaleForm;
