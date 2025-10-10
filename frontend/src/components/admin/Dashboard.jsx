import React, { useState, useEffect } from 'react';
import { getDashboardStats } from '../../services/API';

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalDeliveries: 0,
    pendingDeliveries: 0,
    activeDeliveries: 0,
    completedDeliveries: 0,
    totalAgents: 0,
    availableAgents: 0,
    recentRiskAlerts: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const response = await getDashboardStats();
      setStats(response.data);
    } catch (err) {
      setError('Failed to fetch dashboard stats');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, color }) => (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex items-center">
          <div className={`flex-shrink-0 rounded-md p-3 ${color}`}>
            <div className="h-6 w-6 text-white"></div>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
              <dd className="flex items-baseline">
                <div className="text-2xl font-semibold text-gray-900">{value}</div>
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
        <h3 className="text-lg leading-6 font-medium text-gray-900">Admin Dashboard</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          Overview of system metrics and analytics
        </p>
      </div>
      <div className="px-4 py-5 sm:px-6">
        {error && (
          <div className="rounded-md bg-red-50 p-4 mb-4">
            <div className="text-sm text-red-700">
              {error}
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard 
            title="Total Deliveries" 
            value={stats.totalDeliveries} 
            color="bg-blue-500" 
          />
          <StatCard 
            title="Pending Deliveries" 
            value={stats.pendingDeliveries} 
            color="bg-yellow-500" 
          />
          <StatCard 
            title="Active Deliveries" 
            value={stats.activeDeliveries} 
            color="bg-indigo-500" 
          />
          <StatCard 
            title="Completed Deliveries" 
            value={stats.completedDeliveries} 
            color="bg-green-500" 
          />
          <StatCard 
            title="Total Agents" 
            value={stats.totalAgents} 
            color="bg-purple-500" 
          />
          <StatCard 
            title="Available Agents" 
            value={stats.availableAgents} 
            color="bg-teal-500" 
          />
          <StatCard 
            title="Recent Risk Alerts" 
            value={stats.recentRiskAlerts} 
            color="bg-red-500" 
          />
        </div>
        
        <div className="mt-8">
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Recent Activity</h3>
            </div>
            <div className="px-4 py-5 sm:px-6">
              <div className="flow-root">
                <ul className="divide-y divide-gray-200">
                  <li className="py-4">
                    <div className="flex space-x-3">
                      <div className="flex-shrink-0">
                        <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">D</span>
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-800">New delivery request created</p>
                        <p className="text-sm text-gray-500">2 minutes ago</p>
                      </div>
                    </div>
                  </li>
                  <li className="py-4">
                    <div className="flex space-x-3">
                      <div className="flex-shrink-0">
                        <div className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">A</span>
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-800">Agent assigned to delivery</p>
                        <p className="text-sm text-gray-500">15 minutes ago</p>
                      </div>
                    </div>
                  </li>
                  <li className="py-4">
                    <div className="flex space-x-3">
                      <div className="flex-shrink-0">
                        <div className="h-8 w-8 rounded-full bg-yellow-500 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">R</span>
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-800">New risk alert detected</p>
                        <p className="text-sm text-gray-500">1 hour ago</p>
                      </div>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;