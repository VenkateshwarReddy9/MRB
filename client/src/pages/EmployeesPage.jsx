// client/src/pages/EmployeesPage.jsx

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

const EmployeesPage = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Fetch function extracted for reuse
  const fetchEmployees = async (user) => {
    try {
      const token    = await user.getIdToken();
      const response = await fetch('${API_URL}/api/employees', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error('Unable to load employees. Ensure you have admin access.');
      }
      const json = await response.json();
      setEmployees(json.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Listen for auth state changes, then fetch
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchEmployees(user);
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Filter logic
  const filteredEmployees = employees.filter(emp => {
    const matchesSearch =
      !searchTerm ||
      (emp.full_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.position?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || emp.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':   return 'bg-emerald-100 text-emerald-800';
      case 'inactive': return 'bg-red-100 text-red-800';
      case 'pending':  return 'bg-amber-100 text-amber-800';
      default:         return 'bg-slate-100 text-slate-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg className="animate-spin h-8 w-8 text-blue-400" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 
               7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
        </svg>
        <span className="text-xl text-slate-300 font-medium ml-3">
          Loading employees...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-6 text-center max-w-2xl mx-auto">
        <svg className="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 
               11-18 0 9 9 0 0118 0z"/>
        </svg>
        <h3 className="text-xl font-bold text-red-400 mb-2">
          Error Loading Employees
        </h3>
        <p className="text-red-300">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-2">Employee Management</h2>
        <p className="text-slate-400">Manage employee profiles and information</p>
      </div>

      {/* Search & Filter */}
      <div className="bg-slate-800 p-6 rounded-xl shadow-xl border border-slate-700">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Search Employees
            </label>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400"
                   fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 
                     0 7 7 0 0114 0z"/>
              </svg>
              <input
                type="text"
                placeholder="Search by name, email, or role..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-700 border border-slate-600 
                           rounded-lg text-white placeholder-slate-400 focus:ring-2 
                           focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
              />
            </div>
          </div>
          <div className="md:w-48">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Filter by Status
            </label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 
                         rounded-lg text-white focus:ring-2 focus:ring-blue-500 
                         focus:border-blue-500 transition-all duration-200"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>
      </div>

      {/* Employee Table */}
      <div className="bg-slate-800 rounded-xl shadow-xl border border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700 bg-slate-700/50">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <svg className="w-6 h-6 mr-2 text-blue-400" fill="none" stroke="currentColor"
                   viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 
                     0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 
                     3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857
                     m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 
                     11-6 0 3 3 0 016 0zm6 3a2 2 0 
                     11-4 0 2 2 0 014 0zM7 10a2 2 0 
                     11-4 0 2 2 0 014 0z"/>
              </svg>
              Employee Directory
            </h3>
            <span className="bg-slate-600 text-slate-300 text-sm font-bold px-3 py-1 rounded-full">
              {filteredEmployees.length} {filteredEmployees.length === 1 ? 'employee' : 'employees'}
            </span>
          </div>
        </div>

        {/* Rows */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-700/50">
              <tr>
                <th className="p-4 font-bold uppercase text-slate-400">Employee</th>
                <th className="p-4 font-bold uppercase text-slate-400">Contact</th>
                <th className="p-4 font-bold uppercase text-slate-400">Job Role</th>
                <th className="p-4 font-bold uppercase text-slate-400">Pay Rate</th>
                <th className="p-4 font-bold uppercase text-slate-400">Status</th>
                <th className="p-4 font-bold uppercase text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center p-12">
                    <div className="flex flex-col items-center">
                      <svg className="w-16 h-16 text-slate-600 mb-4" fill="none" stroke="currentColor"
                           viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 
                             0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 
                             3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857
                             m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 
                             11-6 0 3 3 0 016 0zm6 3a2 2 0 
                             11-4 0 2 2 0 014 0zM7 10a2 2 0 
                             11-4 0 2 2 0 014 0z"/>
                      </svg>
                      <p className="text-slate-400 text-lg font-medium">
                        {employees.length === 0 ? 'No employees found' : 'No matching employees'}
                      </p>
                      <p className="text-slate-500 text-sm mt-1">
                        {employees.length === 0
                          ? 'You can create users in the User Access page.'
                          : 'Try adjusting your search or filter criteria.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp, idx) => (
                  <tr key={emp.uid}
                      className={`border-b border-slate-700 hover:bg-slate-700/50 transition-all duration-200 ${
                        idx % 2 === 0 ? 'bg-slate-800/50' : 'bg-slate-800'
                      }`}>
                    {/* Employee */}
                    <td className="p-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-slate-600 rounded-full flex items-center justify-center mr-3">
                          <span className="text-sm font-bold text-white">
                            {(emp.full_name || emp.email).charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-white">
                            {emp.full_name || <span className="text-slate-500 italic">Name not set</span>}
                          </p>
                          <p className="text-slate-400 text-sm">ID: {emp.uid.slice(0, 8)}…</p>
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="p-4">
                      <p className="text-slate-300 font-medium">{emp.email}</p>
                      <p className="text-slate-400 text-sm">
                        {emp.phone || <span className="italic">Phone not set</span>}
                      </p>
                    </td>

                    {/* Role */}
                    <td className="p-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          emp.position ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                        {emp.position || 'Role not set'}
                      </span>
                    </td>

                    {/* Pay Rate */}
                    <td className="p-4">
                      <div className="text-slate-300 font-semibold">
                        £{parseFloat(emp.pay_rate || 0).toFixed(2)}
                        <span className="text-slate-500 text-sm font-normal">/hr</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="p-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          getStatusBadge(emp.status)
                        }`}>
                        <span className={`w-2 h-2 rounded-full mr-2 ${
                            emp.status === 'active'   ? 'bg-emerald-500' :
                            emp.status === 'inactive' ? 'bg-red-500'     :
                            emp.status === 'pending'  ? 'bg-amber-500'   :
                            'bg-slate-500'
                          }`}></span>
                        {emp.status?.charAt(0).toUpperCase() + emp.status?.slice(1) || 'Unknown'}
                      </span>
                    </td>

                    {/* Edit Link */}
                    <td className="p-4">
                      <Link
                        to={`/employees/${emp.uid}/edit`}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold
                                   py-2 px-4 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl
                                   transform hover:-translate-y-0.5 inline-flex items-center"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor"
                             viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 
                               0 002 2h11a2 2 0 002-2v-5m-1.414-9.414
                               a2 2 0 112.828 2.828L11.828 15H9v-2.828
                               l8.586-8.586z"/>
                        </svg>
                        Edit
                      </Link>
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

export default EmployeesPage;
