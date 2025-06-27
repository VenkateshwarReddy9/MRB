// client/src/components/AddExpenseForm.jsx

import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';

// Environment-based API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL ;

const AddExpenseForm = ({ onNewExpense, transactionToEdit, onUpdate, onCancelEdit }) => {
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('Groceries');
    const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);
    const [editReason, setEditReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const expenseCategories = ['Groceries', 'Utilities', 'Wages', 'Marketing', 'Rent', 'Other'];
    const isEditMode = Boolean(transactionToEdit);

    useEffect(() => {
        if (isEditMode) {
            setDescription(transactionToEdit.description);
            setAmount(parseFloat(transactionToEdit.amount));
            setTransactionDate(new Date(transactionToEdit.transaction_date).toISOString().split('T')[0]);
            setCategory(transactionToEdit.category || 'Other');
        }
    }, [transactionToEdit, isEditMode]);

    // ✅ FIXED: Separate function to reset form
    const resetForm = () => {
        setDescription('');
        setAmount('');
        setCategory('Groceries');
        setTransactionDate(new Date().toISOString().split('T')[0]);
        setEditReason('');
    };

    // ✅ FIXED: Safe handling of onCancelEdit prop
    const handleCancel = () => {
        if (onCancelEdit && typeof onCancelEdit === 'function') {
            onCancelEdit();
        }
        resetForm();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        
        // Enhanced validation
        if (!user) {
            alert("You must be logged in to add an expense.");
            return;
        }
        
        if (!description.trim()) {
            alert("Please enter a description.");
            return;
        }
        
        if (!amount || parseFloat(amount) <= 0) {
            alert("Please enter a valid amount greater than 0.");
            return;
        }
        
        if (isEditMode && !editReason.trim()) {
            alert("Please provide a reason for the edit.");
            return;
        }

        setIsSubmitting(true);

        const expenseData = {
            description: description.trim(),
            amount: parseFloat(amount),
            transaction_date: transactionDate,
            type: 'expense',
            category: category,
            ...(isEditMode && { reason: editReason.trim() })
        };
        
        const endpoint = isEditMode 
            ? `${API_BASE_URL}/api/transactions/${transactionToEdit.id}` 
            : `${API_BASE_URL}/api/transactions`;
        const method = isEditMode ? 'PUT' : 'POST';

        try {
            const token = await user.getIdToken();
            const response = await fetch(endpoint, {
                method,
                headers: { 
                    'Content-Type': 'application/json', 
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify(expenseData)
            });

            // ✅ FIXED: Better error handling
            if (!response.ok) {
                const errorData = await response.json();
                console.error('Server Error:', errorData);
                alert(`Error: ${errorData.error || `Server returned ${response.status}`}`);
                return;
            }

            const result = await response.json();
            
            // ✅ FIXED: Proper success handling
            if (isEditMode) {
                if (onUpdate && typeof onUpdate === 'function') {
                    onUpdate(result.data);
                }
                handleCancel(); // This will safely call onCancelEdit if it exists
            } else {
                // ✅ FIXED: Reset form first, then notify parent
                resetForm();
                if (onNewExpense && typeof onNewExpense === 'function') {
                    onNewExpense(result.data);
                }
            }

        } catch (error) {
            console.error('Network Error:', error);
            alert('Network error occurred. Please check your connection and try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-slate-800 p-6 rounded-xl shadow-xl border border-slate-700 hover:shadow-2xl transition-all duration-300 mb-8">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center">
                <span className="w-2 h-8 bg-red-500 rounded-full mr-3"></span>
                {isEditMode ? 'Edit Expense' : 'Add New Expense'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* First Row - Description and Amount */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                        <input 
                            type="text" 
                            value={description} 
                            onChange={(e) => setDescription(e.target.value)} 
                            placeholder="Enter expense description" 
                            required 
                            disabled={isSubmitting} 
                            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed" 
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
                            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed" 
                        />
                    </div>
                </div>
                
                {/* Second Row - Category and Date */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Category</label>
                        <select 
                            value={category} 
                            onChange={(e) => setCategory(e.target.value)} 
                            disabled={isSubmitting} 
                            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {expenseCategories.map(cat => (
                                <option key={cat} value={cat} className="bg-slate-700 text-white">{cat}</option>
                            ))}
                        </select>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Date</label>
                        <input 
                            type="date" 
                            value={transactionDate} 
                            onChange={(e) => setTransactionDate(e.target.value)} 
                            required 
                            disabled={isSubmitting} 
                            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed" 
                        />
                    </div>
                </div>
                
                {/* Edit Reason Field - Only shows in edit mode */}
                {isEditMode && (
                    <div className="bg-amber-900/20 border border-amber-500/50 rounded-lg p-4">
                        <label className="block text-sm font-medium text-amber-300 mb-2">
                            Reason for Edit (Required)
                        </label>
                        <input 
                            type="text" 
                            value={editReason} 
                            onChange={(e) => setEditReason(e.target.value)} 
                            placeholder="Please explain why you're editing this expense" 
                            required 
                            disabled={isSubmitting} 
                            className="w-full px-4 py-3 bg-amber-900/30 border border-amber-500/50 rounded-lg text-white placeholder-amber-400/70 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed" 
                        />
                    </div>
                )}

                {/* Buttons */}
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
                        className="bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg disabled:bg-slate-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:transform-none disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? (
                            <span className="flex items-center">
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Saving...
                            </span>
                        ) : (isEditMode ? 'Save Changes' : 'Add Expense')}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AddExpenseForm;
