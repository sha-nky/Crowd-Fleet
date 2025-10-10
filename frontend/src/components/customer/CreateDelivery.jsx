import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createDelivery } from '../../services/API';
import { loadGoogleMaps, initAutocomplete } from '../../services/GoogleMapsService';

const CreateDelivery = () => {
  const [formData, setFormData] = useState({
    pickupLocation: {
      address: '',
      lat: null,
      lng: null
    },
    dropoffLocation: {
      address: '',
      lat: null,
      lng: null
    },
    packageDetails: {
      weight: '',
      dimensions: {
        length: '',
        width: '',
        height: ''
      },
      description: ''
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  
  // Refs for Google Maps autocomplete elements
  const pickupInputRef = useRef(null);
  const dropoffInputRef = useRef(null);
  const pickupAutocompleteRef = useRef(null);
  const dropoffAutocompleteRef = useRef(null);
  
  // Log form data changes for debugging
  useEffect(() => {
    console.log('Form data updated:', formData);
  }, [formData]);
  
  // Initialize Google Maps Autocomplete
  useEffect(() => {
    let isMounted = true;
    
    const initAutocompleteWidgets = async () => {
      try {
        // Load Google Maps API
        await loadGoogleMaps();
        
        if (!isMounted) return;
        
        console.log('Google Maps loaded, initializing autocomplete widgets');
        
        // Initialize pickup autocomplete
        if (pickupInputRef.current) {
          console.log('Initializing pickup autocomplete');
          pickupAutocompleteRef.current = initAutocomplete(pickupInputRef.current, (place) => {
            console.log('Pickup place selected:', place);
            if (isMounted) {
              setFormData(prev => ({
                ...prev,
                pickupLocation: place
              }));
            }
          });
        }
        
        // Initialize dropoff autocomplete
        if (dropoffInputRef.current) {
          console.log('Initializing dropoff autocomplete');
          dropoffAutocompleteRef.current = initAutocomplete(dropoffInputRef.current, (place) => {
            console.log('Dropoff place selected:', place);
            if (isMounted) {
              setFormData(prev => ({
                ...prev,
                dropoffLocation: place
              }));
            }
          });
        }
      } catch (err) {
        console.error('Error initializing Google Maps:', err);
        if (isMounted) {
          setError('Failed to load address autocomplete. Please try again.');
        }
      }
    };
    
    initAutocompleteWidgets();
    
    // Cleanup function
    return () => {
      isMounted = false;
      if (pickupAutocompleteRef.current) {
        pickupAutocompleteRef.current = null;
      }
      if (dropoffAutocompleteRef.current) {
        dropoffAutocompleteRef.current = null;
      }
    };
  }, []);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Handle nested fields properly
    if (name.includes('.')) {
      const parts = name.split('.');
      setFormData(prev => {
        // Create a deep copy of the previous state
        const newState = JSON.parse(JSON.stringify(prev));
        
        // Navigate to the nested property and update it
        let current = newState;
        for (let i = 0; i < parts.length - 1; i++) {
          current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = value;
        
        return newState;
      });
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Debug log to see what data we're working with
      console.log('Form Data:', formData);
      
      // Validate that we have lat/lng for both locations
      const pickupLat = parseFloat(formData.pickupLocation.lat);
      const pickupLng = parseFloat(formData.pickupLocation.lng);
      const dropoffLat = parseFloat(formData.dropoffLocation.lat);
      const dropoffLng = parseFloat(formData.dropoffLocation.lng);
      
      // Debug log to see parsed values
      console.log('Parsed Coordinates:', { pickupLat, pickupLng, dropoffLat, dropoffLng });
      
      // Check if coordinates are valid numbers and not NaN
      const isPickupValid = !isNaN(pickupLat) && isFinite(pickupLat) && 
                           !isNaN(pickupLng) && isFinite(pickupLng) && 
                           typeof formData.pickupLocation.address === 'string' && 
                           formData.pickupLocation.address.trim() !== '';
      
      const isDropoffValid = !isNaN(dropoffLat) && isFinite(dropoffLat) && 
                            !isNaN(dropoffLng) && isFinite(dropoffLng) && 
                            typeof formData.dropoffLocation.address === 'string' && 
                            formData.dropoffLocation.address.trim() !== '';
      
      // Debug log validation results
      console.log('Validation Results:', { 
        isPickupValid, 
        isDropoffValid,
        pickupLat: { value: formData.pickupLocation.lat, parsed: pickupLat, isNaN: isNaN(pickupLat), isFinite: isFinite(pickupLat) },
        pickupLng: { value: formData.pickupLocation.lng, parsed: pickupLng, isNaN: isNaN(pickupLng), isFinite: isFinite(pickupLng) },
        pickupAddress: { value: formData.pickupLocation.address, type: typeof formData.pickupLocation.address, trimmed: formData.pickupLocation.address?.trim() },
        dropoffLat: { value: formData.dropoffLocation.lat, parsed: dropoffLat, isNaN: isNaN(dropoffLat), isFinite: isFinite(dropoffLat) },
        dropoffLng: { value: formData.dropoffLocation.lng, parsed: dropoffLng, isNaN: isNaN(dropoffLng), isFinite: isFinite(dropoffLng) },
        dropoffAddress: { value: formData.dropoffLocation.address, type: typeof formData.dropoffLocation.address, trimmed: formData.dropoffLocation.address?.trim() }
      });
      
      if (!isPickupValid) {
        setError(`Please select a valid pickup location from the suggestions. 
        Current values - Address: ${formData.pickupLocation.address || 'None'}, 
        Lat: ${formData.pickupLocation.lat}, 
        Lng: ${formData.pickupLocation.lng}`);
        setLoading(false);
        return;
      }
      
      if (!isDropoffValid) {
        setError(`Please select a valid dropoff location from the suggestions.
        Current values - Address: ${formData.dropoffLocation.address || 'None'}, 
        Lat: ${formData.dropoffLocation.lat}, 
        Lng: ${formData.dropoffLocation.lng}`);
        setLoading(false);
        return;
      }

      // Convert numeric values
      const deliveryData = {
        pickupLocation: {
          address: formData.pickupLocation.address,
          lat: pickupLat,
          lng: pickupLng
        },
        dropoffLocation: {
          address: formData.dropoffLocation.address,
          lat: dropoffLat,
          lng: dropoffLng
        },
        packageDetails: {
          weightKg: parseFloat(formData.packageDetails.weight) || 0,
          size: `${parseFloat(formData.packageDetails.dimensions.length) || 0}x${parseFloat(formData.packageDetails.dimensions.width) || 0}x${parseFloat(formData.packageDetails.dimensions.height) || 0}`,
          fragile: false // Default value
        }
      };

      const response = await createDelivery(deliveryData);
      console.log('Create delivery response:', response);
      
      if (response.status === 201) {
        // Successfully created
        console.log('Delivery created successfully');
        navigate('/customer/dashboard');
      } else {
        setError(response.response?.data?.message || 'Failed to create delivery');
      }
    } catch (err) {
      setError('Failed to create delivery. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
        <h3 className="text-lg leading-6 font-medium text-gray-900">Create New Delivery</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          Fill in the details for your delivery request
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
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Pickup Location */}
          <div>
            <h4 className="text-md font-medium text-gray-900 mb-3">Pickup Location</h4>
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div className="sm:col-span-6">
                <label htmlFor="pickup-address" className="block text-sm font-medium text-gray-700">
                  Address
                </label>
                <input
                  ref={pickupInputRef}
                  type="text"
                  id="pickup-address"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Enter pickup address"
                />
                <p className="mt-1 text-sm text-gray-500">Start typing to see address suggestions</p>
                {(formData.pickupLocation.lat && formData.pickupLocation.lng) ? (
                  <p className="mt-1 text-sm text-green-600">
                    Location selected: {formData.pickupLocation.address}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-yellow-600">
                    Please select an address from the suggestions above
                  </p>
                )}
              </div>
            </div>
          </div>
          
          {/* Dropoff Location */}
          <div>
            <h4 className="text-md font-medium text-gray-900 mb-3">Dropoff Location</h4>
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div className="sm:col-span-6">
                <label htmlFor="dropoff-address" className="block text-sm font-medium text-gray-700">
                  Address
                </label>
                <input
                  ref={dropoffInputRef}
                  type="text"
                  id="dropoff-address"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Enter dropoff address"
                />
                <p className="mt-1 text-sm text-gray-500">Start typing to see address suggestions</p>
                {(formData.dropoffLocation.lat && formData.dropoffLocation.lng) ? (
                  <p className="mt-1 text-sm text-green-600">
                    Location selected: {formData.dropoffLocation.address}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-yellow-600">
                    Please select an address from the suggestions above
                  </p>
                )}
              </div>
            </div>
          </div>
          
          {/* Package Details */}
          <div>
            <h4 className="text-md font-medium text-gray-900 mb-3">Package Details</h4>
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div className="sm:col-span-6">
                <label htmlFor="packageDetails.description" className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  name="packageDetails.description"
                  id="packageDetails.description"
                  rows={3}
                  value={formData.packageDetails.description || ''}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              
              <div className="sm:col-span-2">
                <label htmlFor="packageDetails.weight" className="block text-sm font-medium text-gray-700">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="packageDetails.weight"
                  id="packageDetails.weight"
                  value={formData.packageDetails.weight || ''}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              
              <div className="sm:col-span-2">
                <label htmlFor="packageDetails.dimensions.length" className="block text-sm font-medium text-gray-700">
                  Length (cm)
                </label>
                <input
                  type="number"
                  step="0.1"
                  name="packageDetails.dimensions.length"
                  id="packageDetails.dimensions.length"
                  value={formData.packageDetails.dimensions.length || ''}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              
              <div className="sm:col-span-1">
                <label htmlFor="packageDetails.dimensions.width" className="block text-sm font-medium text-gray-700">
                  Width (cm)
                </label>
                <input
                  type="number"
                  step="0.1"
                  name="packageDetails.dimensions.width"
                  id="packageDetails.dimensions.width"
                  value={formData.packageDetails.dimensions.width || ''}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              
              <div className="sm:col-span-1">
                <label htmlFor="packageDetails.dimensions.height" className="block text-sm font-medium text-gray-700">
                  Height (cm)
                </label>
                <input
                  type="number"
                  step="0.1"
                  name="packageDetails.dimensions.height"
                  id="packageDetails.dimensions.height"
                  value={formData.packageDetails.dimensions.height || ''}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>
          </div>
          
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => navigate('/customer/dashboard')}
              className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Delivery'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateDelivery;