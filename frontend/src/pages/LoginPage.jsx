import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import nexusLogoFull from '../assets/nexus-logo-full.png';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button, Input } from '../components/common/FormComponents';

const LoginPage = () => {
  const { user, login, loading } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ email: 'neel.patel@nexus.com', password: 'admin12345' });
  const [showPass, setShowPass] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(form.email, form.password);
    if (!result.success) {
      toast.error(result.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img
            src={nexusLogoFull}
            alt="Nexus"
            className="h-20 w-auto max-w-full mx-auto mb-4 object-contain drop-shadow-lg"
          />
          <h1 className="text-3xl font-bold text-white">
            Nexus Dashboard
          </h1>

          <p className="text-slate-400 mt-1">
            Project & Team Management Platform
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Welcome back</h2>
          <p className="text-sm text-gray-500 mb-6">Sign in to your account</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <Input
                type="email"
                placeholder="Enter your email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <Input
                  type={showPass ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <Button type="submit" loading={loading} className="w-full" size="lg">
              Sign In
            </Button>
          </form>

          {/* Demo credentials */}
          <div className="mt-6 p-4 bg-blue-50 rounded-xl text-xs">
            <p className="font-semibold text-blue-800 mb-2">
              Nexus Demo Credentials
            </p>

            <div className="space-y-1 text-blue-700">
              <p>
                <strong>Admin:</strong> neel.patel@nexus.com / admin12345
              </p>

              <p>
                <strong>Admin:</strong> kevin.patel@nexus.com / admin12345
              </p>

              <p>
                <strong>HOD:</strong> pratik.mistry@nexus.com / hod12345
              </p>

              <p>
                <strong>Team Lead:</strong> ravi.darji@nexus.com / lead12345
              </p>

              <p>
                <strong>Employee:</strong> astha.verma@nexus.com / astha123
              </p>

              <p>
                <strong>Employee:</strong> juhee.gade@nexus.com / Juhee123
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
