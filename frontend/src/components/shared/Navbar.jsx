import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

const Navbar = ({ user, onLogout }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    onLogout();
    navigate('/login');
  };

  return (
    <nav className="bg-blue-600 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 flex items-center">
              <span className="text-xl font-bold">CrowdFleet</span>
            </Link>
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                {user?.role === 'admin' && (
                  <>
                    <Link to="/admin/dashboard" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700">Dashboard</Link>
                    <Link to="/admin/users" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700">Users</Link>
                    <Link to="/admin/deliveries" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700">Deliveries</Link>
                    <Link to="/admin/risk-alerts" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700">Risk Alerts</Link>
                  </>
                )}
                {user?.role === 'agent' && (
                  <>
                    <Link to="/agent/dashboard" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700">Dashboard</Link>
                    <Link to="/agent/deliveries" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700">My Deliveries</Link>
                    <Link to="/agent/map" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700">Map</Link>
                  </>
                )}
                {user?.role === 'customer' && (
                  <>
                    <Link to="/customer/dashboard" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700">Dashboard</Link>
                    <Link to="/customer/create-delivery" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700">Create Delivery</Link>
                    <Link to="/customer/my-deliveries" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700">My Deliveries</Link>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="ml-4 flex items-center md:ml-6">
              {user ? (
                <div className="ml-3 relative">
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-medium">{user.name}</span>
                    <button
                      onClick={handleLogout}
                      className="px-3 py-1 rounded-md text-sm font-medium bg-red-500 hover:bg-red-600"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex space-x-2">
                  <Link to="/login" className="px-3 py-1 rounded-md text-sm font-medium bg-blue-500 hover:bg-blue-600">
                    Login
                  </Link>
                  <Link to="/register" className="px-3 py-1 rounded-md text-sm font-medium bg-green-500 hover:bg-green-600">
                    Register
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;