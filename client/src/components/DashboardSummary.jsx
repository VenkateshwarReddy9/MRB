// client/src/components/DashboardSummary.jsx

import React from 'react';

// This is a simple "presentational" component. Its only job is to display
// the 'summary' object that it receives as a prop.
const DashboardSummary = ({ summary }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-slate-800 p-6 rounded-xl shadow-xl border border-slate-700 hover:shadow-2xl transition-all duration-300">
                <div className="flex items-center mb-4">
                    <div className="w-2 h-8 bg-red-500 rounded-full mr-3"></div>
                    <h3 className="text-slate-400 text-sm font-bold uppercase tracking-wider">Selected Day's Expenses</h3>
                </div>
                <div className="flex items-baseline space-x-2">
                    <p className="text-4xl font-bold text-red-400">£{summary.todaysExpenses.toFixed(2)}</p>
                    <span className="text-slate-500 text-lg">GBP</span>
                </div>
                <div className="mt-3 flex items-center">
                    <svg className="w-4 h-4 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 4a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zm8 0a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1h-6a1 1 0 01-1-1v-6z" clipRule="evenodd" />
                    </svg>
                    <span className="text-slate-400 text-sm">Total outgoing</span>
                </div>
            </div>
            
            <div className="bg-slate-800 p-6 rounded-xl shadow-xl border border-slate-700 hover:shadow-2xl transition-all duration-300">
                <div className="flex items-center mb-4">
                    <div className="w-2 h-8 bg-slate-500 rounded-full mr-3"></div>
                    <h3 className="text-slate-400 text-sm font-bold uppercase tracking-wider">Previous Day's Expenses</h3>
                </div>
                <div className="flex items-baseline space-x-2">
                    <p className="text-4xl font-bold text-slate-300">£{summary.yesterdaysExpenses.toFixed(2)}</p>
                    <span className="text-slate-500 text-lg">GBP</span>
                </div>
                <div className="mt-3 flex items-center">
                    <svg className="w-4 h-4 text-slate-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                    </svg>
                    <span className="text-slate-400 text-sm">Historical data</span>
                </div>
            </div>
        </div>
    );
};

export default DashboardSummary;
