// client/src/pages/ShiftTemplatesPage.jsx

import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const ShiftTemplatesPage = () => {
    const [templates, setTemplates] = useState([]);
    const [name, setName] = useState('');
    const [startTime, setStartTime] = useState('09:00');
    const [durationHours, setDurationHours] = useState(8);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [deletingId, setDeletingId] = useState(null);

    // This function fetches all templates from the backend.
    const fetchTemplates = async () => {
        const token = await auth.currentUser.getIdToken();
        try {
            const response = await fetch(`${API_URL}/api/shift-templates`, {
                headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    }
            });
            const data = await response.json();
            if (response.ok) {
                setTemplates(data.data || []);
            } else {
                throw new Error(data.error || 'Failed to fetch templates.');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Fetch templates when the component mounts if a user is logged in.
    useEffect(() => {
        if(auth.currentUser) {
            fetchTemplates();
        }
    }, [auth.currentUser]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);

        // Convert duration from hours to minutes for backend storage.
        const duration_minutes = parseFloat(durationHours) * 60;
        if (isNaN(duration_minutes) || duration_minutes <= 0) {
            setError('Please enter a valid, positive duration.');
            setSubmitting(false);
            return;
        }

        const token = await auth.currentUser.getIdToken();
        try {
            const response = await fetch(`${API_URL}/api/shift-templates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ name, start_time: startTime, duration_minutes })
            });
            
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to create template.');
            
            // Refresh the list from the server to ensure UI is in sync
            fetchTemplates();

            // Reset the form to default values
            setName('');
            setStartTime('09:00');
            setDurationHours(8);
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };
    
    const handleDelete = async (templateId) => {
        if (!window.confirm("Are you sure you want to delete this template? All scheduled shifts using this template will also be removed.")) return;
        
        setDeletingId(templateId);
        const token = await auth.currentUser.getIdToken();
        try {
            const response = await fetch(`${API_URL}/api/shift-templates/${templateId}`, {
                method: 'DELETE',
                headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    }
            });
            if (!response.ok) throw new Error('Failed to delete template.');
            setTemplates(templates.filter(t => t.id !== templateId));
        } catch (err) {
            setError(err.message);
        } finally {
            setDeletingId(null);
        }
    };

    // Helper function to calculate end time
    const calculateEndTime = (startTime, durationMinutes) => {
        const [hours, minutes] = startTime.split(':').map(Number);
        const startDate = new Date();
        startDate.setHours(hours, minutes, 0, 0);
        
        const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
        return endDate.toTimeString().slice(0, 5);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
                <h2 className="text-3xl font-bold text-white mb-2">Shift Templates</h2>
                <p className="text-slate-400">Create and manage reusable shift templates</p>
            </div>

            {/* Create Template Form */}
            <div className="bg-slate-800 p-6 rounded-xl shadow-xl border border-slate-700 max-w-4xl mx-auto">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center">
                    <svg className="w-6 h-6 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Create New Template
                </h3>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-300 mb-2">Shift Name</label>
                            <input 
                                type="text" 
                                value={name} 
                                onChange={e => setName(e.target.value)} 
                                placeholder="e.g., Morning Shift, Evening Shift" 
                                required 
                                disabled={submitting}
                                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed" 
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Duration (Hours)</label>
                            <input 
                                type="number" 
                                step="0.5" 
                                min="0.5" 
                                max="24"
                                value={durationHours} 
                                onChange={e => setDurationHours(e.target.value)} 
                                required 
                                disabled={submitting}
                                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed" 
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Start Time</label>
                            <input 
                                type="time" 
                                value={startTime} 
                                onChange={e => setStartTime(e.target.value)} 
                                required 
                                disabled={submitting}
                                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed" 
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">End Time (Calculated)</label>
                            <div className="w-full px-4 py-3 bg-slate-600 border border-slate-500 rounded-lg text-slate-300">
                                {startTime && durationHours ? calculateEndTime(startTime, parseFloat(durationHours) * 60) : '--:--'}
                            </div>
                        </div>
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
                            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center"
                        >
                            {submitting ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Create Template
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            {/* Templates Table */}
            <div className="bg-slate-800 rounded-xl shadow-xl border border-slate-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-700 bg-slate-700/50">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-white flex items-center">
                            <svg className="w-6 h-6 mr-2 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Shift Templates
                        </h3>
                        <span className="bg-slate-600 text-slate-300 text-sm font-bold px-3 py-1 rounded-full">
                            {templates.length} {templates.length === 1 ? 'template' : 'templates'}
                        </span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-700/50">
                            <tr>
                                <th className="p-4 font-bold uppercase text-slate-400 tracking-wider">Template Name</th>
                                <th className="p-4 font-bold uppercase text-slate-400 tracking-wider">Start Time</th>
                                <th className="p-4 font-bold uppercase text-slate-400 tracking-wider">Duration</th>
                                <th className="p-4 font-bold uppercase text-slate-400 tracking-wider">End Time</th>
                                <th className="p-4 font-bold uppercase text-slate-400 tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="text-center p-12">
                                        <div className="flex items-center justify-center">
                                            <svg className="animate-spin h-8 w-8 text-blue-400 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            <span className="text-slate-400 text-lg">Loading templates...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : templates.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="text-center p-12">
                                        <div className="flex flex-col items-center">
                                            <svg className="w-16 h-16 text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            <h3 className="text-xl font-semibold text-slate-400 mb-2">No templates found</h3>
                                            <p className="text-slate-500">Create your first shift template to get started.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                templates.map((template, index) => (
                                    <tr key={template.id} className={`border-b border-slate-700 hover:bg-slate-700/50 transition-all duration-200 ${index % 2 === 0 ? 'bg-slate-800/50' : 'bg-slate-800'}`}>
                                        <td className="p-4">
                                            <div className="flex items-center">
                                                <div className="w-10 h-10 bg-slate-600 rounded-full flex items-center justify-center mr-3">
                                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2V6" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-white text-lg">{template.name}</p>
                                                    <p className="text-slate-400 text-sm">Template ID: {template.id}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                {template.start_time}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-800">
                                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                {(template.duration_minutes / 60).toFixed(1)} hours
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                {calculateEndTime(template.start_time, template.duration_minutes)}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <button 
                                                onClick={() => handleDelete(template.id)} 
                                                disabled={deletingId === template.id}
                                                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center"
                                            >
                                                {deletingId === template.id ? (
                                                    <>
                                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                        Deleting...
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                        Delete
                                                    </>
                                                )}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ShiftTemplatesPage;
