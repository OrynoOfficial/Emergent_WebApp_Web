import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';
import { Badge } from '../components/ui/badge';
import { UserPlus, Mail, CheckCircle } from 'lucide-react';

export default function Register() {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    role: 'customer',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inviteData, setInviteData] = useState(null);
  const [inviteLoading, setInviteLoading] = useState(!!inviteToken);
  const { register } = useAuth();
  const navigate = useNavigate();

  // Validate invite token on mount
  useEffect(() => {
    if (!inviteToken) return;
    const validate = async () => {
      try {
        const { data } = await api.get(`/invitations/validate/${inviteToken}`);
        setInviteData(data);
        setFormData(prev => ({ ...prev, email: data.email, role: data.role }));
      } catch (err) {
        setError(err.response?.data?.detail || 'Invalid or expired invitation link');
      } finally {
        setInviteLoading(false);
      }
    };
    validate();
  }, [inviteToken]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (inviteToken && inviteData) {
        // Accept invitation flow
        await api.post('/invitations/accept', {
          token: inviteToken,
          full_name: formData.full_name,
          password: formData.password,
          phone: formData.phone,
        });
        setSuccess(true);
        setTimeout(() => navigate('/login'), 2000);
      } else {
        // Normal registration
        await register(formData);
        setSuccess(true);
        setTimeout(() => navigate('/login'), 2000);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (inviteLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#082c59] mx-auto mb-4" />
          <p className="text-slate-600">Validating invitation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="card max-w-md w-full">
        <div className="text-center mb-8">
          {inviteData ? (
            <>
              <div className="w-14 h-14 bg-[#082c59]/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <UserPlus className="w-7 h-7 text-[#082c59]" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900">You&apos;re Invited!</h1>
              <p className="text-gray-600 mt-2">
                <strong>{inviteData.invited_by_name}</strong> invited you to join Oryno
              </p>
              {inviteData.message && (
                <p className="text-sm text-slate-500 mt-2 bg-slate-50 p-3 rounded-lg italic">
                  &ldquo;{inviteData.message}&rdquo;
                </p>
              )}
              <div className="flex items-center justify-center gap-2 mt-3">
                <Badge className="bg-[#082c59] text-white capitalize">{inviteData.role}</Badge>
                <Badge variant="outline" className="text-xs">
                  <Mail className="w-3 h-3 mr-1" /> {inviteData.email}
                </Badge>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-gray-900">Create Account</h1>
              <p className="text-gray-600 mt-2">Join the Oryno Platform</p>
            </>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Account created successfully! Redirecting to login...
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
            <input
              type="text"
              name="full_name"
              className="input"
              value={formData.full_name}
              onChange={handleChange}
              placeholder="John Doe"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              name="email"
              className="input"
              value={formData.email}
              onChange={handleChange}
              placeholder="your@email.com"
              required
              disabled={!!inviteData}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone (optional)</label>
            <input
              type="tel"
              name="phone"
              className="input"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+237 6XX XXX XXX"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <input
              type="password"
              name="password"
              className="input"
              value={formData.password}
              onChange={handleChange}
              placeholder="Minimum 6 characters"
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="btn btn-primary w-full"
          >
            {loading ? 'Creating account...' : inviteData ? 'Accept & Create Account' : 'Create Account'}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-gray-600">
          Already have an account?{' '}
          <Link to="/login" className="text-primary hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
