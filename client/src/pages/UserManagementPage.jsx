// client/src/pages/UserManagementPage.jsx
import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';

const UserManagementPage = ({ userProfile }) => {
    const [users, setUsers] = useState([]);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('staff');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [disablingId, setDisablingId] = useState(null);

    useEffect(() => {
        const fetchUsers = async () => {
            if (!auth.currentUser) return;
            setLoading(true);
            try {
                const token = await auth.currentUser.getIdToken();
                const response = await fetch('${API_URL}/api/users', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await response.json();
                if (response.ok) {
                    setUsers(data.data);
                } else {
                    setError(data.error || 'Failed to fetch users.');
                }
            } catch (err) {
                setError('Failed to load users.');
            } finally {
                setLoading(false);
            }
        };
        fetchUsers();
    }, []);

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setCreating(true);
        
        try {
            const token = await auth.currentUser.getIdToken();
            const response = await fetch('${API_URL}:5000/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ email, password, role })
            });
            const data = await response.json();
            if (response.ok) {
                setMessage(data.message);
                setUsers([...users, data.data]);
                setEmail('');
                setPassword('');
                setRole('staff');
            } else {
                setError(data.error || 'Failed to create user.');
            }
        } catch (err) {
            setError('An error occurred while creating the user.');
        } finally {
            setCreating(false);
        }
    };

    const handleDisableUser = async (userToDisable) => {
        if (!window.confirm(`Are you sure you want to disable the user: ${userToDisable.email}? They will no longer be able to log in.`)) return;
        
        setDisablingId(userToDisable.uid);
        try {
            const token = await auth.currentUser.getIdToken();
            const response = await fetch(`${API_URL}/api/users/${userToDisable.uid}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok) {
                alert(data.message);
                setUsers(prevUsers => prevUsers.map(u => 
                    u.uid === userToDisable.uid ? { ...u, status: 'inactive' } : u
                ));
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (err) {
            alert('An unexpected error occurred.');
        } finally {
            setDisablingId(null);
        }
    };

    // Helper function to get role badge styling
    const getRoleBadge = (role) => {
        switch (role) {
            case 'admin':
                return { text: 'Admin', className: 'bg-purple-100 text-purple-800' };
            case 'secondary_admin':
                return { text: 'Secondary Admin', className: 'bg-blue-100 text-blue-800' };
            case 'staff':
                return { text: 'Staff', className: 'bg-emerald-100 text-emerald-800' };
            default:
                return { text: role, className: 'bg-slate-100 text-slate-800' };
        }
    };

    // Helper function to get status badge styling
    const getStatusBadge = (status) => {
        switch (status) {
            case 'active':
                return { text: 'Active', className: 'bg-emerald-100 text-emerald-800' };
            case 'inactive':
                return { text: 'Inactive', className: 'bg-red-100 text-red-800' };
            default:
                return { text: status, className: 'bg-slate-100 text-slate-800' };
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
                <h2 className="text-3xl font-bold text-white mb-2">User Management</h2>
                <p className="text-slate-400">Create and manage system user accounts</p>
            </div>

            {/* Create New User Card */}
            <div className="bg-slate-800 p-6 rounded-xl shadow-xl border border-slate-700">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center">
                    <svg className="w-6 h-6 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    Create New User
                </h3>
                
                <form onSubmit={handleCreateUser} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Email Address</label>
                            <input 
                                type="email" 
                                value={email} 
                                onChange={e => setEmail(e.target.value)} 
                                placeholder="Enter user email" 
                                required 
                                disabled={creating}
                                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed" 
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
                            <input 
                                type="password" 
                                value={password} 
                                onChange={e => setPassword(e.target.value)} 
                                placeholder="Enter password" 
                                required 
                                disabled={creating}
                                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed" 
                            />
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">User Role</label>
                            <select 
                                value={role} 
                                onChange={e => setRole(e.target.value)} 
                                disabled={creating}
                                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <option value="staff">Staff Member</option>
                                <option value="secondary_admin">Secondary Admin</option>
                            </select>
                        </div>
                        
                        <div className="flex items-end">
                            <button 
                                type="submit" 
                                disabled={creating}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center"
                            >
                                {creating ? (
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
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                        </svg>
                                        Create User
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                    
                    {message && (
                        <div className="bg-emerald-900/20 border border-emerald-500/50 rounded-lg p-4">
                            <div className="flex items-center">
                                <svg className="w-5 h-5 text-emerald-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span className="text-emerald-300 font-medium">{message}</span>
                            </div>
                        </div>
                    )}
                    
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
                </form>
            </div>

            {/* Existing Users Card */}
            <div className="bg-slate-800 rounded-xl shadow-xl border border-slate-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-700 bg-slate-700/50">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-white flex items-center">
                            <svg className="w-6 h-6 mr-2 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            System Users
                        </h3>
                        <span className="bg-slate-600 text-slate-300 text-sm font-bold px-3 py-1 rounded-full">
                            {users.length} {users.length === 1 ? 'user' : 'users'}
                        </span>
                    </div>
                </div>

                <div className="p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="flex items-center space-x-3">
                                <svg className="animate-spin h-6 w-6 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span className="text-slate-300 font-medium">Loading users...</span>
                            </div>
                        </div>
                    ) : users.length === 0 ? (
                        <div className="text-center py-12">
                            <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <h3 className="text-xl font-semibold text-slate-400 mb-2">No users found</h3>
                            <p className="text-slate-500">Create your first user to get started.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {users.map((user, index) => {
                                const roleBadge = getRoleBadge(user.role);
                                const statusBadge = getStatusBadge(user.status);
                                const isCurrentUser = userProfile.uid === user.uid;
                                
                                return (
                                    <div key={user.uid} className={`bg-slate-700 border border-slate-600 p-5 rounded-lg transition-all duration-200 hover:bg-slate-650 shadow-lg ${user.status === 'inactive' ? 'opacity-60' : ''}`}>
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <div className="flex items-center space-x-3 mb-3">
                                                    <div className="w-10 h-10 bg-slate-600 rounded-full flex items-center justify-center">
                                                        <span className="text-sm font-bold text-white">
                                                            {user.email.charAt(0).toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold text-white text-lg flex items-center">
                                                            {user.email}
                                                            {isCurrentUser && (
                                                                <span className="ml-2 text-xs bg-blue-500 text-white px-2 py-1 rounded-full">You</span>
                                                            )}
                                                        </h4>
                                                        <p className="text-slate-400 text-sm">User ID: {user.uid.slice(0, 8)}...</p>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex items-center space-x-3">
                                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${roleBadge.className}`}>
                                                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                        </svg>
                                                        {roleBadge.text}
                                                    </span>
                                                    
                                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${statusBadge.className}`}>
                                                        <span className={`w-2 h-2 rounded-full mr-2 ${
                                                            user.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'
                                                        }`}></span>
                                                        {statusBadge.text}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            {/* Actions */}
                                            <div className="ml-4">
                                                {!isCurrentUser && user.status === 'active' && (
                                                    <button 
                                                        onClick={() => handleDisableUser(user)} 
                                                        disabled={disablingId === user.uid}
                                                        className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center"
                                                    >
                                                        {disablingId === user.uid ? (
                                                            <>
                                                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                </svg>
                                                                Disabling...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
                                                                </svg>
                                                                Disable
                                                            </>
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserManagementPage;
