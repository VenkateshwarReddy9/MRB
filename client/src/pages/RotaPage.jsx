// client/src/pages/RotaPage.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { auth } from '../firebase';
import { format, addDays, subDays, startOfWeek, isWithinInterval, parse, addMinutes } from 'date-fns';

const API_URL = import.meta.env.VITE_API_URL ;
// --- Reusable Modal Component ---
const Modal = ({ children, onClose }) => (
  <div className="fixed inset-0 bg-black bg-opacity-70 z-40 flex justify-center items-center" onClick={onClose}>
    <div className="bg-slate-800 rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 border border-slate-700" onClick={e => e.stopPropagation()}>
      {children}
    </div>
  </div>
);

// --- Reusable Button Component ---
const ActionButton = ({ onClick, disabled, loading, variant, children, className = "" }) => {
  const baseClasses = "font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center";
  
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white",
    secondary: "bg-slate-600 hover:bg-slate-500 text-white",
    success: "bg-emerald-600 hover:bg-emerald-700 text-white",
    warning: "bg-amber-600 hover:bg-amber-700 text-white",
    danger: "bg-red-600 hover:bg-red-700 text-white",
    purple: "bg-purple-600 hover:bg-purple-700 text-white"
  };

  return (
    <button 
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${variants[variant]} ${className}`}
    >
      {loading && (
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {children}
    </button>
  );
};

// --- Reusable Loading Spinner ---
const LoadingSpinner = ({ text = "Loading..." }) => (
  <div className="flex items-center justify-center py-12">
    <svg className="animate-spin h-8 w-8 text-blue-400 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    <span className="text-slate-400 text-lg">{text}</span>
  </div>
);

const RotaPage = () => {
  // --- CONSOLIDATED STATE MANAGEMENT ---
  const [weekStartDate, setWeekStartDate] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [isEditMode, setIsEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Data states
  const [employees, setEmployees] = useState([]);
  const [shiftTemplates, setShiftTemplates] = useState([]);
  const [scheduledShifts, setScheduledShifts] = useState([]);
  const [unavailability, setUnavailability] = useState([]);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalData, setModalData] = useState({ user_uid: null, shift_date: null });
  const [shiftEntries, setShiftEntries] = useState([{ shift_template_id: '', custom_start: '', custom_end: '' }]);

  // Action states
  const [actionStates, setActionStates] = useState({
    assigning: false,
    removing: null,
    publishing: false,
    copying: false,
    smartAssigning: false
  });

  // Advanced features states
  const [showEventsModal, setShowEventsModal] = useState(false);
  const [weekEvents, setWeekEvents] = useState([]);
  const [smartAssignSettings, setSmartAssignSettings] = useState({
    consider_events: false,
    max_labor_cost_percentage: 25,
    priority_factors: {
      availability: 0.4,
      cost: 0.3,
      experience: 0.2,
      fairness: 0.1
    }
  });

  // --- HELPER FUNCTIONS ---
  const updateActionState = (action, value) => {
    setActionStates(prev => ({ ...prev, [action]: value }));
  };

  const makeApiCall = async (url, options = {}) => {
    const token = await auth.currentUser.getIdToken();
    const defaultHeaders = { 'Authorization': `Bearer ${token}` };
    
    if (options.method && options.method !== 'GET') {
      defaultHeaders['Content-Type'] = 'application/json';
    }

    return fetch(`${API_URL}${url}`, {
      ...options,
      headers: { ...defaultHeaders, ...options.headers }
    });
  };

  const weekDays = useMemo(() => 
    Array.from({ length: 7 }, (_, i) => addDays(weekStartDate, i)), 
    [weekStartDate]
  );

  const isEmployeeUnavailable = (employeeUid, date) => {
    return unavailability.some(unavail => 
      unavail.user_uid === employeeUid && 
      isWithinInterval(date, { 
        start: new Date(unavail.start_time), 
        end: new Date(unavail.end_time) 
      })
    );
  };

  // --- DATA FETCHING ---
  const fetchDataForWeek = async (startDate) => {
    setLoading(true);
    setError('');
    
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }

    const endDate = addDays(startDate, 6);
    
    try {
      const [employeesRes, templatesRes, rotaRes, availabilityRes] = await Promise.all([
        makeApiCall('/api/employees'),
        makeApiCall('/api/shift-templates'),
        makeApiCall(`/api/rota?start_date=${format(startDate, 'yyyy-MM-dd')}&end_date=${format(endDate, 'yyyy-MM-dd')}`),
        makeApiCall(`/api/availability/rota?start_date=${format(startDate, 'yyyy-MM-dd')}&end_date=${format(endDate, 'yyyy-MM-dd')}`)
      ]);

      if (!employeesRes.ok || !templatesRes.ok || !rotaRes.ok || !availabilityRes.ok) {
        throw new Error("Failed to load week data");
      }

      const [employeesData, templatesData, rotaData, availabilityData] = await Promise.all([
        employeesRes.json(),
        templatesRes.json(),
        rotaRes.json(),
        availabilityRes.json()
      ]);

      setEmployees(employeesData.data || []);
      setShiftTemplates(templatesData.data || []);
      setScheduledShifts(rotaData.data || []);
      setUnavailability(availabilityData.data || []);

    } catch (err) {
      console.error('Error fetching rota data:', err);
      setError(err.message || 'Failed to load rota data');
    } finally {
      setLoading(false);
    }
  };

  const fetchWeekEvents = async () => {
    try {
      const response = await makeApiCall(`/api/rota/events?week_start=${format(weekStartDate, 'yyyy-MM-dd')}`);
      if (response.ok) {
        const data = await response.json();
        setWeekEvents(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch events:', error);
    }
  };

  // --- COST & HOUR CALCULATIONS ---
  const rotaCalculations = useMemo(() => {
    const employeeData = {};
    let totalWeeklyCost = 0;
    let totalWeeklyHours = 0;

    employees.forEach(emp => {
      employeeData[emp.uid] = { totalHours: 0, totalCost: 0 };
    });

    scheduledShifts.forEach(shift => {
      const employee = employees.find(emp => emp.uid === shift.user_uid);
      if (!employee) return;

      let durationHours = 0;
      if (shift.custom_start_time && shift.custom_end_time) {
        const startTime = parse(shift.custom_start_time, 'HH:mm:ss', new Date());
        const endTime = parse(shift.custom_end_time, 'HH:mm:ss', new Date());
        if (endTime < startTime) endTime.setDate(endTime.getDate() + 1);
        durationHours = (endTime - startTime) / (1000 * 60 * 60);
      } else if (shift.actual_start_time && shift.actual_end_time) {
        const startTime = parse(shift.actual_start_time, 'HH:mm:ss', new Date());
        const endTime = parse(shift.actual_end_time, 'HH:mm:ss', new Date());
        if (endTime < startTime) endTime.setDate(endTime.getDate() + 1);
        durationHours = (endTime - startTime) / (1000 * 60 * 60);
      } else {
        durationHours = (shift.duration_minutes || 0) / 60;
      }
      
      if (durationHours > 0) {
        const shiftCost = durationHours * parseFloat(employee.pay_rate || 0);
        employeeData[shift.user_uid].totalHours += durationHours;
        employeeData[shift.user_uid].totalCost += shiftCost;
        totalWeeklyCost += shiftCost;
        totalWeeklyHours += durationHours;
      }
    });

    return { totalWeeklyCost, totalWeeklyHours, employeeData };
  }, [scheduledShifts, employees]);

  // --- MODAL CONTROLS ---
  const openAssignModal = (user_uid, shift_date) => {
    setModalData({ user_uid, shift_date });
    setShiftEntries([{ shift_template_id: '', custom_start: '', custom_end: '' }]);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalData({ user_uid: null, shift_date: null });
    setShiftEntries([{ shift_template_id: '', custom_start: '', custom_end: '' }]);
  };

  const addEntry = () => {
    setShiftEntries([...shiftEntries, { shift_template_id: '', custom_start: '', custom_end: '' }]);
  };

  const updateEntry = (i, field, value) => {
    const updated = [...shiftEntries];
    updated[i][field] = value;
    setShiftEntries(updated);
  };

  // --- API HANDLERS ---
  const handleAssignShift = async () => {
    updateActionState('assigning', true);
    
    try {
      await Promise.all(shiftEntries.map(entry => {
        const body = {
          user_uid: modalData.user_uid,
          shift_template_id: entry.shift_template_id ? parseInt(entry.shift_template_id) : null,
          shift_date: format(modalData.shift_date, 'yyyy-MM-dd'),
          custom_start_time: entry.custom_start || null,
          custom_end_time: entry.custom_end || null
        };
        
        return makeApiCall('/api/rota', {
          method: 'POST',
          body: JSON.stringify(body)
        }).then(response => {
          if (!response.ok) {
            return response.json().then(err => {
              throw new Error(err.error || `HTTP ${response.status}`);
            });
          }
          return response.json();
        });
      }));
      
      fetchDataForWeek(weekStartDate);
      closeModal();
    } catch (err) {
      console.error('Assignment error:', err);
      alert(`Error: ${err.message}`);
    } finally {
      updateActionState('assigning', false);
    }
  };

  const handleRemoveShift = async (scheduledShiftId) => {
    if (!window.confirm("Are you sure you want to remove this shift?")) return;
    
    updateActionState('removing', scheduledShiftId);
    
    try {
      const response = await makeApiCall(`/api/rota/${scheduledShiftId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      fetchDataForWeek(weekStartDate);
    } catch (err) {
      console.error('Delete error:', err);
      alert(`Error: ${err.message}`);
    } finally {
      updateActionState('removing', null);
    }
  };

  const handleCopyPreviousWeek = async () => {
    if (!window.confirm("Copy shifts from previous week? This will overwrite existing shifts.")) return;
    
    updateActionState('copying', true);
    
    try {
      const response = await makeApiCall('/api/rota/copy-previous-week', {
        method: 'POST',
        body: JSON.stringify({
          target_week_start: format(weekStartDate, 'yyyy-MM-dd'),
          overwrite_conflicts: true
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Successfully copied ${result.data.copied_shifts} shifts from previous week`);
        fetchDataForWeek(weekStartDate);
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Copy previous week error:', error);
      alert('Failed to copy previous week');
    } finally {
      updateActionState('copying', false);
    }
  };

  const handleSmartAssign = async () => {
    if (!window.confirm("Smart assign shifts based on availability and costs? This will overwrite existing shifts.")) return;
    
    updateActionState('smartAssigning', true);
    
    try {
      const response = await makeApiCall('/api/rota/smart-assign', {
        method: 'POST',
        body: JSON.stringify({
          week_start: format(weekStartDate, 'yyyy-MM-dd'),
          consider_events: smartAssignSettings.consider_events,
          events: weekEvents,
          max_labor_cost_percentage: smartAssignSettings.max_labor_cost_percentage,
          priority_factors: smartAssignSettings.priority_factors
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Successfully assigned ${result.data.assigned_shifts} shifts using smart algorithm`);
        fetchDataForWeek(weekStartDate);
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Smart assign error:', error);
      alert('Failed to perform smart assignment');
    } finally {
      updateActionState('smartAssigning', false);
    }
  };

  const handlePublish = async () => {
    if (!window.confirm("Are you sure you want to publish this week's rota?")) return;
    
    updateActionState('publishing', true);
    
    try {
      const response = await makeApiCall('/api/rota/publish', {
        method: 'POST',
        body: JSON.stringify({ 
          week_start: format(weekStartDate, 'yyyy-MM-dd')
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const data = await response.json();
      alert(data.message);
      setIsEditMode(false);
      fetchDataForWeek(weekStartDate); 
    } catch (err) {
      console.error('Publish error:', err);
      alert(`Error: ${err.message}`);
    } finally {
      updateActionState('publishing', false);
    }
  };

  // --- SHIFT RENDERING HELPER ---
  const renderShift = (shift) => {
    let startTime, endTime, shiftName, durationHours;
    
    if (shift.custom_start_time && shift.custom_end_time) {
      startTime = format(parse(shift.custom_start_time, 'HH:mm:ss', new Date()), 'HH:mm');
      endTime = format(parse(shift.custom_end_time, 'HH:mm:ss', new Date()), 'HH:mm');
      shiftName = 'Custom Shift';
      
      const start = parse(shift.custom_start_time, 'HH:mm:ss', new Date());
      const end = parse(shift.custom_end_time, 'HH:mm:ss', new Date());
      if (end < start) end.setDate(end.getDate() + 1);
      durationHours = (end - start) / (1000 * 60 * 60);
    } else {
      startTime = shift.actual_start_time ? 
        format(parse(shift.actual_start_time, 'HH:mm:ss', new Date()), 'HH:mm') : 
        format(parse(shift.start_time, 'HH:mm:ss', new Date()), 'HH:mm');
      endTime = shift.actual_end_time ? 
        format(parse(shift.actual_end_time, 'HH:mm:ss', new Date()), 'HH:mm') : 
        format(addMinutes(parse(shift.start_time, 'HH:mm:ss', new Date()), shift.duration_minutes), 'HH:mm');
      shiftName = shift.shift_name || 'Unknown Shift';
      durationHours = (shift.duration_minutes || 0) / 60;
    }
    
    return (
      <div key={shift.id} className={`p-3 rounded-lg shadow-lg border transition-all duration-200 hover:shadow-xl ${
        shift.custom_start_time 
          ? 'bg-purple-900/50 border-purple-500/50 text-purple-100' 
          : 'bg-blue-900/50 border-blue-500/50 text-blue-100'
      }`}>
        <div className="flex items-center justify-between mb-1">
          <p className="font-bold text-xs">{shiftName}</p>
          {shift.custom_start_time && (
            <span className="text-xs bg-purple-500 text-white px-1 rounded">Custom</span>
          )}
        </div>
        <p className="text-sm font-semibold">{startTime} - {endTime}</p>
        <p className="text-xs opacity-75 mt-1">
          {Math.round(durationHours * 10) / 10}h
        </p>
        {isEditMode && (
          <button 
            onClick={() => handleRemoveShift(shift.id)} 
            disabled={actionStates.removing === shift.id}
            className="text-red-400 hover:text-red-300 text-xs underline mt-2 disabled:opacity-50"
          >
            {actionStates.removing === shift.id ? 'Removing...' : 'Remove'}
          </button>
        )}
      </div>
    );
  };

  // --- EFFECTS ---
  useEffect(() => {
    if (auth.currentUser) {
      fetchDataForWeek(weekStartDate);
      fetchWeekEvents();
    }
  }, [weekStartDate, auth.currentUser]);

  // --- RENDER ---
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-2">Weekly Rota Management</h2>
        <p className="text-slate-400">Schedule and manage employee shifts</p>
      </div>

      {/* Main Control Header */}
      <div className="bg-slate-800 p-6 rounded-xl shadow-xl border border-slate-700">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <ActionButton 
            onClick={() => setWeekStartDate(subDays(weekStartDate, 7))}
            variant="secondary"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Previous Week
          </ActionButton>
          
          <div className="text-center">
            <h3 className="text-xl text-white font-bold">
              {format(weekStartDate, 'do MMM')} - {format(addDays(weekStartDate, 6), 'do MMM yyyy')}
            </h3>
            <div className="flex items-center justify-center space-x-6 mt-2 text-sm">
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-1 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
                <span className="text-amber-400 font-semibold">£{rotaCalculations.totalWeeklyCost.toFixed(2)}</span>
              </div>
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-1 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-blue-400 font-semibold">{rotaCalculations.totalWeeklyHours.toFixed(1)}h</span>
              </div>
            </div>
          </div>
          
          <ActionButton 
            onClick={() => setWeekStartDate(addDays(weekStartDate, 7))}
            variant="secondary"
          >
            Next Week
            <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </ActionButton>
        </div>
      </div>
      
      {/* Edit/Publish Controls */}
      <div className="flex justify-center items-center gap-4 flex-wrap">
        {!isEditMode ? (
          <ActionButton 
            onClick={() => setIsEditMode(true)}
            variant="primary"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Rota
          </ActionButton>
        ) : (
          <>
            <ActionButton 
              onClick={() => setIsEditMode(false)}
              variant="secondary"
            >
              Cancel Edits
            </ActionButton>
            
            <ActionButton 
              onClick={handleCopyPreviousWeek}
              loading={actionStates.copying}
              variant="purple"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {actionStates.copying ? 'Copying...' : 'Copy Previous Week'}
            </ActionButton>

            <ActionButton 
              onClick={() => setShowEventsModal(true)}
              variant="warning"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Smart Assign
            </ActionButton>
            
            <ActionButton 
              onClick={handlePublish}
              loading={actionStates.publishing}
              variant="success"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {actionStates.publishing ? 'Publishing...' : 'Save & Publish'}
            </ActionButton>
          </>
        )}
      </div>
      
      {/* Error Message */}
      {error && (
        <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="text-red-300 font-medium">{error}</span>
          </div>
        </div>
      )}

      {/* Rota Table */}
      <div className="bg-slate-800 rounded-xl shadow-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-700/50">
              <tr>
                <th className="sticky left-0 bg-slate-700 p-4 font-bold uppercase text-slate-400 z-10 w-48 border-r border-slate-600">
                  Employee
                </th>
                {weekDays.map(day => (
                  <th key={day.toISOString()} className="p-4 font-bold uppercase text-slate-400 text-center min-w-[180px] border-l border-slate-600">
                    <div>{format(day, 'EEE')}</div>
                    <div className="text-xs font-normal text-slate-500 mt-1">
                      {format(day, 'do MMM')}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center p-12">
                    <LoadingSpinner text="Loading Rota..." />
                  </td>
                </tr>
              ) : employees.map((emp, index) => (
                <tr key={emp.uid} className={`border-b border-slate-700 ${index % 2 === 0 ? 'bg-slate-800/50' : 'bg-slate-800'}`}>
                  <td className="sticky left-0 bg-slate-800 p-4 text-white font-semibold align-top z-10 border-r border-slate-700">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center mr-3">
                        <span className="text-xs font-bold text-white">
                          {(emp.full_name || emp.email).charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="font-semibold">{emp.full_name || emp.email}</div>
                        <div className="text-xs text-slate-400 mt-1 space-y-1">
                          <div className="flex items-center">
                            <svg className="w-3 h-3 mr-1 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {rotaCalculations.employeeData[emp.uid]?.totalHours.toFixed(1) || '0.0'}h
                          </div>
                          <div className="flex items-center">
                            <svg className="w-3 h-3 mr-1 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                            </svg>
                            £{rotaCalculations.employeeData[emp.uid]?.totalCost.toFixed(2) || '0.00'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </td>
                  {weekDays.map(day => {
                    const dayString = format(day, 'yyyy-MM-dd');
                    const shiftsForDay = scheduledShifts.filter(s => 
                      s.user_uid === emp.uid && format(new Date(s.shift_date), 'yyyy-MM-dd') === dayString
                    );
                    const isUnavailable = isEmployeeUnavailable(emp.uid, day);
                    
                    return (
                      <td key={day.toISOString()} className="p-3 align-top border-l border-slate-700">
                        <div className="space-y-2 min-h-[80px]">
                          {isUnavailable && (
                            <div className="bg-red-900/30 border border-red-500/50 p-2 rounded-lg text-center">
                              <div className="flex items-center justify-center text-red-300 text-xs">
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
                                </svg>
                                Unavailable
                              </div>
                            </div>
                          )}
                          
                          {shiftsForDay.map(renderShift)}
                          
                          {isEditMode && !isUnavailable && (
                            <button 
                              onClick={() => openAssignModal(emp.uid, day)} 
                              className="w-full bg-slate-600 hover:bg-slate-500 text-slate-200 text-xs p-3 rounded-lg transition-all duration-200 border border-slate-600 hover:border-slate-500 flex items-center justify-center"
                            >
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                              Add Shift
                            </button>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Shift Assignment Modal */}
      {isModalOpen && (
        <Modal onClose={closeModal}>
          <h3 className="text-xl font-bold text-white mb-4 flex items-center">
            <svg className="w-6 h-6 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Assign Shifts to {employees.find(e => e.uid === modalData.user_uid)?.full_name}
          </h3>
          
          <div className="space-y-4">
            {shiftEntries.map((entry, idx) => (
              <div key={idx} className="grid grid-cols-3 gap-3 items-center">
                <select
                  value={entry.shift_template_id}
                  onChange={(e) => updateEntry(idx, 'shift_template_id', e.target.value)}
                  className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                >
                  <option value="">--Custom--</option>
                  {shiftTemplates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.start_time} - {t.duration_minutes/60}hrs)
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  value={entry.custom_start}
                  onChange={(e) => updateEntry(idx, 'custom_start', e.target.value)}
                  className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                />
                <input
                  type="time"
                  value={entry.custom_end}
                  onChange={(e) => updateEntry(idx, 'custom_end', e.target.value)}
                  className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                />
                {idx === shiftEntries.length - 1 && (
                  <button
                    onClick={addEntry}
                    className="col-span-3 bg-slate-700 hover:bg-slate-600 text-blue-400 text-sm py-1 rounded-lg transition-all duration-200 flex items-center justify-center"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add Another Shift
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end space-x-4 mt-6 pt-4 border-t border-slate-700">
            <ActionButton
              onClick={closeModal}
              disabled={actionStates.assigning}
              variant="secondary"
            >
              Cancel
            </ActionButton>
            <ActionButton
              onClick={handleAssignShift}
              loading={actionStates.assigning}
              variant="primary"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {actionStates.assigning ? 'Assigning...' : 'Assign Shifts'}
            </ActionButton>
          </div>
        </Modal>
      )}

      {/* Smart Assignment Modal */}
      {showEventsModal && (
        <Modal onClose={() => setShowEventsModal(false)}>
          <h3 className="text-xl font-bold text-white mb-4 flex items-center">
            <svg className="w-6 h-6 mr-2 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Smart Assignment Settings
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="flex items-center text-white mb-2">
                <input
                  type="checkbox"
                  checked={smartAssignSettings.consider_events}
                  onChange={(e) => setSmartAssignSettings(prev => ({
                    ...prev,
                    consider_events: e.target.checked
                  }))}
                  className="mr-2"
                />
                Consider special events/matches
              </label>
              
              {weekEvents.length > 0 && (
                <div className="bg-slate-700 p-3 rounded-lg">
                  <p className="text-sm text-slate-300 mb-2">Events this week:</p>
                  {weekEvents.map((event, index) => (
                    <div key={index} className="text-sm text-amber-300">
                      {event.date}: {event.name} ({event.type})
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-white text-sm mb-2">
                Max Labor Cost % of Sales: {smartAssignSettings.max_labor_cost_percentage}%
              </label>
              <input
                type="range"
                min="15"
                max="35"
                value={smartAssignSettings.max_labor_cost_percentage}
                onChange={(e) => setSmartAssignSettings(prev => ({
                  ...prev,
                  max_labor_cost_percentage: parseInt(e.target.value)
                }))}
                className="w-full"
              />
            </div>

            <div>
              <p className="text-white text-sm mb-2">Assignment Priority Factors:</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(smartAssignSettings.priority_factors).map(([key, value]) => (
                  <div key={key}>
                    <label className="text-slate-300 capitalize">
                      {key}: {(value * 100).toFixed(0)}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={value}
                      onChange={(e) => setSmartAssignSettings(prev => ({
                        ...prev,
                        priority_factors: {
                          ...prev.priority_factors,
                          [key]: parseFloat(e.target.value)
                        }
                      }))}
                      className="w-full"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-4 mt-6 pt-4 border-t border-slate-700">
            <ActionButton
              onClick={() => setShowEventsModal(false)}
              disabled={actionStates.smartAssigning}
              variant="secondary"
            >
              Cancel
            </ActionButton>
            <ActionButton
              onClick={() => {
                setShowEventsModal(false);
                handleSmartAssign();
              }}
              loading={actionStates.smartAssigning}
              variant="warning"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {actionStates.smartAssigning ? 'Assigning...' : 'Smart Assign Shifts'}
            </ActionButton>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default RotaPage;
