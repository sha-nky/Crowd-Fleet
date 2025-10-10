import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { register as registerAPI } from '../../services/API';
import { getCurrentLocation } from '../../services/GoogleMapsService';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('customer');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [locationError, setLocationError] = useState('');
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  // Get current location when role changes to agent
  useEffect(() => {
    if (role === 'agent' && !lat && !lng) {
      getLocation();
    }
  }, [role]);

  const getLocation = async () => {
    setIsGettingLocation(true);
    setLocationError('');
    
    try {
      const location = await getCurrentLocation();
      setLat(location.lat.toString());
      setLng(location.lng.toString());
    } catch (err) {
      console.error('Error getting location:', err);
      setLocationError('Unable to get your location. Please enter it manually or try again.');
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      const userData = {
        name,
        email,
        phone,
        password,
        role
      };

      // Add location for agents
      if (role === 'agent' && lat && lng) {
        userData.location = { lat: parseFloat(lat), lng: parseFloat(lng) };
      }

      const response = await registerAPI(userData);
      
      if (response.data && response.data.token) {
        login(response.data.user, response.data.token);
        
        // Redirect based on user role
        switch (response.data.user.role) {
          case 'admin':
            navigate('/admin/dashboard');
            break;
          case 'agent':
            navigate('/agent/dashboard');
            break;
          case 'customer':
          default:
            navigate('/customer/dashboard');
            break;
        }
      } else {
        setError('Invalid response from server');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to register');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Create your account
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-700">
                {error}
              </div>
            </div>
          )}
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Full Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Full Name"
              />
            </div>
            
            <div>
              <label htmlFor="email-address" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
              />
            </div>
            
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                Phone Number
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Phone Number"
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Password"
              />
            </div>
            
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700">
                Confirm Password
              </label>
              <input
                id="confirm-password"
                name="confirm-password"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Confirm Password"
              />
            </div>
            
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                Role
              </label>
              <select
                id="role"
                name="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              >
                <option value="customer">Customer</option>
                <option value="agent">Delivery Agent</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            
            {role === 'agent' && (
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-md">
                  <h3 className="text-sm font-medium text-blue-800">Agent Location</h3>
                  <p className="text-sm text-blue-700 mt-1">
                    Your current location will be used for delivery assignments. 
                    Make sure location services are enabled in your browser.
                  </p>
                  
                  {locationError && (
                    <div className="mt-2 rounded-md bg-red-50 p-2">
                      <p className="text-sm text-red-700">{locationError}</p>
                    </div>
                  )}
                  
                  <div className="mt-3 flex space-x-2">
                    <button
                      type="button"
                      onClick={getLocation}
                      disabled={isGettingLocation}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {isGettingLocation ? 'Getting Location...' : 'Get Current Location'}
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="lat" className="block text-sm font-medium text-gray-700">
                      Latitude
                    </label>
                    <input
                      id="lat"
                      name="lat"
                      type="number"
                      step="any"
                      value={lat}
                      onChange={(e) => setLat(e.target.value)}
                      className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                      placeholder="Latitude"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="lng" className="block text-sm font-medium text-gray-700">
                      Longitude
                    </label>
                    <input
                      id="lng"
                      name="lng"
                      type="number"
                      step="any"
                      value={lng}
                      onChange={(e) => setLng(e.target.value)}
                      className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                      placeholder="Longitude"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </div>
        </form>
        <div className="text-center">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;