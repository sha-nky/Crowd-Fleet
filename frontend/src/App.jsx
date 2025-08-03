import React, { useEffect, useState } from 'react';
import { testConnection } from './services/API';

export default function App() {
  const [backendMessage, setBackendMessage] = useState('Connecting to backend...');

  useEffect(() => {
    testConnection()
      .then((res) => {
        setBackendMessage(res.data.message);
      })
      .catch((err) => {
        setBackendMessage('Failed to connect to backend ❌');
        console.error(err);
      });
  }, []);

  return (
    <div className='h-screen w-full flex flex-col items-center justify-center bg-blue-400 gap-6'>
      <p className='text-7xl text-white font-bold'>SMART CROWD</p>
      <p className='text-white text-2xl'>{backendMessage}</p>
    </div>
  );
}
