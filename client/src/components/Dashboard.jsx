import React, { useState, useEffect, useCallback } from 'react';
import { auth } from '../firebase';
import AddExpenseForm from './AddExpenseForm';
import AddSaleForm from './AddSaleForm';
import TransactionList from './TransactionList';
import ApprovalQueue from './ApprovalQueue';
import TimeClock from './TimeClock';
import RealTimeAnalytics from './RealTimeAnalytics';
import DashboardSummary from './DashboardSummary';
import ErrorBoundary from './ErrorBoundary';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const Dashboard = ({ userProfile }) => {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({
    todaysExpenses: 0,
    yesterdaysExpenses: 0,
    todaysSales: 0,
    yesterdaysSales: 0,
    todaysSaleCount: 0,
    todaysExpenseCount: 0,
    avgSaleAmount: 0,
    maxSaleAmount: 0
  });
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const isAdmin = userProfile?.role?.includes('admin') || false;

  const refreshData = useCallback(async (date = selectedDate, forceRefresh = false) => {
    if (!auth.currentUser || !userProfile) return;

    setLoading(true);
    setError('');

    try {
      const token = await auth.currentUser.getIdToken();

      const transactionEndpoint = isAdmin
        ? `/api/transactions/all?date=${date}&limit=100`
        : `/api/transactions?date=${date}&limit=100`;

      const transactionResponse = await fetch(`${API_BASE_URL}${transactionEndpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!transactionResponse.ok) {
        throw new Error(`Failed to fetch transactions: ${transactionResponse.status}`);
      }

      const transactionData = await transactionResponse.json();
      const sortedData = (transactionData?.data || []).sort(
        (a, b) => new Date(b.transaction_date) - new Date(a.transaction_date)
      );
      setTransactions(sortedData);

      if (isAdmin) {
        try {
          const summaryResponse = await fetch(`${API_BASE_URL}/api/dashboard/summary?date=${date}`, {
            headers: { Authorization: `Bearer ${token}` }
          });

          if (summaryResponse.ok) {
            const summaryData = await summaryResponse.json();
            setSummary(prev => ({
              ...prev,
              ...summaryData?.data,
              todaysSales: parseFloat(summaryData?.data?.todaysSales || 0),
              todaysExpenses: parseFloat(summaryData?.data?.todaysExpenses || 0),
              yesterdaysSales: parseFloat(summaryData?.data?.yesterdaysSales || 0),
              yesterdaysExpenses: parseFloat(summaryData?.data?.yesterdaysExpenses || 0),
              todaysSaleCount: parseInt(summaryData?.data?.todaysSaleCount || 0),
              todaysExpenseCount: parseInt(summaryData?.data?.todaysExpenseCount || 0),
              avgSaleAmount: parseFloat(summaryData?.data?.avgSaleAmount || 0),
              maxSaleAmount: parseFloat(summaryData?.data?.maxSaleAmount || 0)
            }));
          } else {
            console.warn('Dashboard summary failed, using existing data');
          }
        } catch (summaryError) {
          console.warn('Dashboard summary failed:', summaryError);
        }
      }

      if (forceRefresh) {
        setRefreshKey(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to load dashboard data. Please try refreshing the page.');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, userProfile, isAdmin]);

  useEffect(() => {
    if (userProfile) {
      refreshData(selectedDate);
    }
  }, [selectedDate, userProfile, refreshData]);

  const handleActionComplete = useCallback(async (action = 'update') => {
    setEditingTransaction(null);
    await refreshData(selectedDate, true);
  }, [refreshData, selectedDate]);

  const handleEditClick = useCallback((transaction) => {
    setEditingTransaction(transaction);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleDateChange = useCallback(async (newDate) => {
    setSelectedDate(newDate);
    setEditingTransaction(null);
    await refreshData(newDate, true);
  }, [refreshData]);

  const salesTransactions = transactions.filter(t => t.type === 'sale');
  const expenseTransactions = transactions.filter(t => t.type === 'expense');

  if (error) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-6 mb-8">
          <h3 className="text-red-400 font-semibold mb-2">Error Loading Dashboard</h3>
          <p className="text-red-300">{error}</p>
          <button
            onClick={() => refreshData(selectedDate, true)}
            className="mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto" key={refreshKey}>
      {loading && (
        <div className="fixed top-4 right-4 bg-slate-800 border border-slate-700 rounded-lg p-4 z-50">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-500"></div>
            <span className="text-slate-300 text-sm">Updating dashboard...</span>
          </div>
        </div>
      )}

      {!isAdmin && <TimeClock />}

      {isAdmin && (
        <>
          <div className="bg-gradient-to-r from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-700/50 p-6 rounded-2xl shadow-xl">
            <div className="flex items-center justify-center space-x-4">
              <label htmlFor="date-picker" className="font-semibold text-white flex items-center">
                <svg className="w-5 h-5 mr-2 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Select Date:
              </label>
              <input
                type="date"
                id="date-picker"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="bg-slate-700/50 border border-slate-600/50 text-white p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 backdrop-blur-sm"
              />
              <button
                onClick={() => refreshData(selectedDate, true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl transition-colors flex items-center"
                disabled={loading}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>
          </div>

          <DashboardSummary summary={summary} key={`summary-${refreshKey}`} />

          <ErrorBoundary>
            <RealTimeAnalytics key={`analytics-${refreshKey}`} />
          </ErrorBoundary>

          <ErrorBoundary>
            <ApprovalQueue onActionComplete={handleActionComplete} key={`approval-${refreshKey}`} />
          </ErrorBoundary>
        </>
      )}

      {editingTransaction ? (
        <div className="max-w-4xl mx-auto">
          <ErrorBoundary>
            {editingTransaction.type === 'sale' ? (
              <AddSaleForm
                transactionToEdit={editingTransaction}
                onUpdate={() => handleActionComplete('update')}
                onCancelEdit={() => setEditingTransaction(null)}
              />
            ) : (
              <AddExpenseForm
                transactionToEdit={editingTransaction}
                onUpdate={() => handleActionComplete('update')}
                onCancelEdit={() => setEditingTransaction(null)}
              />
            )}
          </ErrorBoundary>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 max-w-7xl mx-auto">
          <div className="w-full">
            <ErrorBoundary>
              <AddSaleForm onNewSale={() => handleActionComplete('create')} />
            </ErrorBoundary>
          </div>
          <div className="w-full">
            <ErrorBoundary>
              <AddExpenseForm onNewExpense={() => handleActionComplete('create')} />
            </ErrorBoundary>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 max-w-7xl mx-auto">
        <div className="w-full">
          <ErrorBoundary>
            <TransactionList
              title="Sales"
              transactions={salesTransactions}
              userProfile={userProfile}
              onEdit={handleEditClick}
              onActionComplete={() => handleActionComplete('delete')}
              key={`sales-${refreshKey}`}
            />
          </ErrorBoundary>
        </div>
        <div className="w-full">
          <ErrorBoundary>
            <TransactionList
              title="Expenses"
              transactions={expenseTransactions}
              userProfile={userProfile}
              onEdit={handleEditClick}
              onActionComplete={() => handleActionComplete('delete')}
              key={`expenses-${refreshKey}`}
            />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
