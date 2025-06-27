// client/src/pages/EditEmployeePage.jsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

const EditEmployeePage = () => {
  const { uid } = useParams();
  const navigate = useNavigate();

  const [employee, setEmployee] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [saving, setSaving]     = useState(false);

  // Listen for auth state, then fetch employee data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      try {
        const token    = await user.getIdToken();
        const response = await fetch(`${API_URL}/api/employees/${uid}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.status === 404) {
          throw new Error('Employee not found');
        }
        if (!response.ok) {
          throw new Error(`Fetch failed: ${response.status}`);
        }

        const { data } = await response.json();
        setEmployee(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [uid]);

  // Handle controlled input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEmployee((prev) => ({ ...prev, [name]: value }));
  };

  // Submit updated data to backend
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    if (!auth.currentUser) {
      setError('User not authenticated');
      setSaving(false);
      return;
    }

    const updateData = {
      full_name:                employee.full_name || '',
      phone:                    employee.phone || '',
      address:                  employee.address || '',
      pay_rate:                 parseFloat(employee.pay_rate) || 0,
      position:                 employee.position || 'Staff',
      department:               employee.department || 'Restaurant',
      hire_date:                employee.hire_date || null,
      emergency_contact_name:   employee.emergency_contact_name || '',
      emergency_contact_phone:  employee.emergency_contact_phone || ''
    };

    try {
      const token    = await auth.currentUser.getIdToken();
      const response = await fetch(`${API_URL}/api/employees/${uid}`, {
        method:  'PUT',
        headers: {
          'Content-Type':  'application/json',
          Authorization:   `Bearer ${token}`
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errObj = await response.json().catch(() => ({}));
        throw new Error(errObj.error || `Update failed: ${response.status}`);
      }

      alert('Employee profile updated successfully!');
      navigate('/employees');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg className="animate-spin h-8 w-8 text-blue-400" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 
            0 12h4zm2 5.291A7.962 7.962 0 014 
            12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
        </svg>
        <span className="text-xl text-slate-300 font-medium ml-3">
          Loading employee profile...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-6 text-center max-w-md mx-auto">
        <h3 className="text-xl font-bold text-red-400 mb-2">Error</h3>
        <p className="text-red-300 mb-4">{error}</p>
        <button
          onClick={() => navigate('/employees')}
          className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg"
        >
          Back to Employees
        </button>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 text-center max-w-md mx-auto">
        <h3 className="text-xl font-bold text-slate-400 mb-2">Employee Not Found</h3>
        <p className="text-slate-500 mb-4">The requested profile could not be found.</p>
        <button
          onClick={() => navigate('/employees')}
          className="bg-slate-600 hover:bg-slate-500 text-white font-semibold py-2 px-4 rounded-lg"
        >
          Back to Employees
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-2">Edit Employee Profile</h2>
        <p className="text-slate-400">
          Updating profile for&nbsp;
          <span className="font-medium text-slate-300">{employee.email}</span>
        </p>
      </div>

      {/* Edit Form */}
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto bg-slate-800 rounded-xl shadow-xl border border-slate-700 overflow-hidden">
        {/* Personal Information */}
        <div className="px-6 py-4 border-b border-slate-700 bg-slate-700/50">
          <h4 className="text-lg font-semibold text-white">Personal Information</h4>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="full_name" className="block text-sm font-medium text-slate-300 mb-2">
                Full Name *
              </label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                value={employee.full_name || ''}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white"
              />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-slate-300 mb-2">
                Phone Number
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={employee.phone || ''}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white"
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="address" className="block text-sm font-medium text-slate-300 mb-2">
                Address
              </label>
              <textarea
                id="address"
                name="address"
                rows="3"
                value={employee.address || ''}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white"
              />
            </div>
          </div>
        </div>

        {/* Job Details */}
        <div className="px-6 py-4 border-t border-slate-700 bg-slate-700/50">
          <h4 className="text-lg font-semibold text-white">Job Information</h4>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label htmlFor="position" className="block text-sm font-medium text-slate-300 mb-2">
                Position
              </label>
              <select
                id="position"
                name="position"
                value={employee.position || 'Staff'}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white"
              >
                <option>Staff</option>
                <option>Kitchen Staff</option>
                <option>Server</option>
                <option>Cashier</option>
                <option>Cook</option>
                <option>Manager</option>
                <option>Assistant Manager</option>
                <option>Supervisor</option>
              </select>
            </div>
            <div>
              <label htmlFor="department" className="block text-sm font-medium text-slate-300 mb-2">
                Department
              </label>
              <select
                id="department"
                name="department"
                value={employee.department || 'Restaurant'}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white"
              >
                <option>Restaurant</option>
                <option>Kitchen</option>
                <option>Front of House</option>
                <option>Management</option>
                <option>Delivery</option>
              </select>
            </div>
            <div>
              <label htmlFor="pay_rate" className="block text-sm font-medium text-slate-300 mb-2">
                Pay Rate (£/hr)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">£</span>
                <input
                  id="pay_rate"
                  name="pay_rate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={employee.pay_rate || ''}
                  onChange={handleInputChange}
                  className="w-full pl-8 pr-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white"
                />
              </div>
            </div>
            <div>
              <label htmlFor="hire_date" className="block text-sm font-medium text-slate-300 mb-2">
                Hire Date
              </label>
              <input
                id="hire_date"
                name="hire_date"
                type="date"
                value={employee.hire_date || ''}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white"
              />
            </div>
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="px-6 py-4 border-t border-slate-700 bg-slate-700/50">
          <h4 className="text-lg font-semibold text-white">Emergency Contact</h4>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="emergency_contact_name" className="block text-sm font-medium text-slate-300 mb-2">
                Contact Name
              </label>
              <input
                id="emergency_contact_name"
                name="emergency_contact_name"
                type="text"
                value={employee.emergency_contact_name || ''}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white"
              />
            </div>
            <div>
              <label htmlFor="emergency_contact_phone" className="block text-sm font-medium text-slate-300 mb-2">
                Contact Phone
              </label>
              <input
                id="emergency_contact_phone"
                name="emergency_contact_phone"
                type="tel"
                value={employee.emergency_contact_phone || ''}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-slate-700 bg-slate-700/50 flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate('/employees')}
            disabled={saving}
            className="bg-slate-600 hover:bg-slate-500 text-white font-semibold py-2 px-4 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditEmployeePage;
