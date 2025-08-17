import React from 'react';

// Modern Dashboard Summary Component with Enhanced Error Handling
const DashboardSummary = ({ summary }) => {
  // Add null checks and default values to prevent undefined errors
  const safeSummary = {
    todaysSales: parseFloat(summary?.todaysSales || 0),
    todaysExpenses: parseFloat(summary?.todaysExpenses || 0),
    yesterdaysSales: parseFloat(summary?.yesterdaysSales || 0),
    yesterdaysExpenses: parseFloat(summary?.yesterdaysExpenses || 0),
    todaysSaleCount: parseInt(summary?.todaysSaleCount || 0),
    todaysExpenseCount: parseInt(summary?.todaysExpenseCount || 0),
    avgSaleAmount: parseFloat(summary?.avgSaleAmount || 0),
    maxSaleAmount: parseFloat(summary?.maxSaleAmount || 0)
  };

  const todaysProfit = safeSummary.todaysSales - safeSummary.todaysExpenses;
  const yesterdaysProfit = safeSummary.yesterdaysSales - safeSummary.yesterdaysExpenses;
  const profitClass = (profit) => profit >= 0 ? 'text-emerald-400' : 'text-red-400';

  return (
    <div className="space-y-8 mb-8">
      {/* Modern Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Today's Sales */}
        <div className="group relative bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 backdrop-blur-sm border border-emerald-500/20 rounded-2xl p-6 hover:border-emerald-400/40 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/10">
          <div className="absolute top-4 right-4">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center group-hover:bg-emerald-500/30 transition-colors">
              <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-slate-400 text-sm font-medium">Today's Sales</p>
            <p className="text-3xl font-bold text-emerald-400">£{safeSummary.todaysSales.toFixed(2)}</p>
            <p className="text-xs text-slate-500">{safeSummary.todaysSaleCount} transactions</p>
          </div>
        </div>

        {/* Today's Expenses */}
        <div className="group relative bg-gradient-to-br from-red-500/10 to-red-600/5 backdrop-blur-sm border border-red-500/20 rounded-2xl p-6 hover:border-red-400/40 transition-all duration-300 hover:shadow-2xl hover:shadow-red-500/10">
          <div className="absolute top-4 right-4">
            <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center group-hover:bg-red-500/30 transition-colors">
              <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
              </svg>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-slate-400 text-sm font-medium">Today's Expenses</p>
            <p className="text-3xl font-bold text-red-400">£{safeSummary.todaysExpenses.toFixed(2)}</p>
            <p className="text-xs text-slate-500">{safeSummary.todaysExpenseCount} transactions</p>
          </div>
        </div>

        {/* Average Sale */}
        <div className="group relative bg-gradient-to-br from-blue-500/10 to-blue-600/5 backdrop-blur-sm border border-blue-500/20 rounded-2xl p-6 hover:border-blue-400/40 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/10">
          <div className="absolute top-4 right-4">
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-slate-400 text-sm font-medium">Average Sale</p>
            <p className="text-3xl font-bold text-blue-400">£{safeSummary.avgSaleAmount.toFixed(2)}</p>
            <p className="text-xs text-slate-500">Max: £{safeSummary.maxSaleAmount.toFixed(2)}</p>
          </div>
        </div>

        {/* Today's Profit */}
        <div className="group relative bg-gradient-to-br from-purple-500/10 to-purple-600/5 backdrop-blur-sm border border-purple-500/20 rounded-2xl p-6 hover:border-purple-400/40 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/10">
          <div className="absolute top-4 right-4">
            <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
              <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-slate-400 text-sm font-medium">Today's Profit</p>
            <p className={`text-3xl font-bold ${profitClass(todaysProfit)}`}>
              {todaysProfit >= 0 ? `£${todaysProfit.toFixed(2)}` : `-£${Math.abs(todaysProfit).toFixed(2)}`}
            </p>
            <p className="text-xs text-slate-500">Net result</p>
          </div>
        </div>
      </div>

      {/* Modern Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="relative bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 hover:border-slate-600/50 transition-all duration-300 hover:shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent rounded-2xl"></div>
          <div className="relative text-center space-y-4">
            <h3 className="text-slate-300 text-lg font-semibold">Today's Performance</h3>
            <p className={`text-5xl font-bold ${profitClass(todaysProfit)}`}>
              {todaysProfit >= 0 ? `£${todaysProfit.toFixed(2)}` : `-£${Math.abs(todaysProfit).toFixed(2)}`}
            </p>
            <p className="text-slate-500 text-sm">Net profit/loss</p>
          </div>
        </div>

        <div className="relative bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 hover:border-slate-600/50 transition-all duration-300 hover:shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent rounded-2xl"></div>
          <div className="relative text-center space-y-4">
            <h3 className="text-slate-300 text-lg font-semibold">Yesterday's Performance</h3>
            <p className={`text-5xl font-bold ${profitClass(yesterdaysProfit)}`}>
              {yesterdaysProfit >= 0 ? `£${yesterdaysProfit.toFixed(2)}` : `-£${Math.abs(yesterdaysProfit).toFixed(2)}`}
            </p>
            <p className="text-slate-500 text-sm">Previous performance</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardSummary;
