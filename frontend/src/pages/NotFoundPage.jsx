import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, AlertCircle } from 'lucide-react';
import { Button } from '../components/common/FormComponents';

const NotFoundPage = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <AlertCircle size={64} className="text-gray-300" />
        </div>
        <h1 className="text-6xl font-bold text-gray-200">404</h1>
        <p className="text-xl font-semibold text-gray-600">Page Not Found</p>
        <p className="text-gray-400">The page you are looking for does not exist.</p>
        <Button onClick={() => navigate('/')}>
          <Home size={16} /> Go to Dashboard
        </Button>
      </div>
    </div>
  );
};

export default NotFoundPage;
