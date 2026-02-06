import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Mail, Lock, User, Loader, Eye, EyeOff, Check, X, ArrowLeft, ArrowRight } from 'lucide-react';

interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

interface PasswordValidation {
  minLength: boolean;
  hasUpperLower: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}

const investmentFocusOptions = [
  { id: 'single-family', label: 'Single Family', description: 'Flip/Rental' },
  { id: 'multi-family', label: 'Multi-Family', description: 'Apartments' },
  { id: 'build-to-sell', label: 'Build-to-Sell', description: 'Development' },
  { id: 'land', label: 'Land', description: 'Development' },
  { id: 'commercial', label: 'Commercial', description: 'Real Estate' },
  { id: 'airbnb', label: 'Airbnb/STR', description: 'Properties' },
];

const experienceLevels = [
  { id: 'beginner', label: 'Just Starting (0-5 deals)' },
  { id: 'active', label: 'Active Investor (6-20 deals/year)' },
  { id: 'professional', label: 'Professional (20+ deals/year)' },
  { id: 'institution', label: 'Institution/Fund' },
];

export default function RegisterForm({ onSwitchToLogin }: RegisterFormProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeUpdates, setAgreeUpdates] = useState(false);
  const [investmentFocus, setInvestmentFocus] = useState<string[]>([]);
  const [experienceLevel, setExperienceLevel] = useState('');
  const [markets, setMarkets] = useState<string[]>([]);
  const [newMarket, setNewMarket] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const validatePassword = (pwd: string): PasswordValidation => ({
    minLength: pwd.length >= 8,
    hasUpperLower: /[a-z]/.test(pwd) && /[A-Z]/.test(pwd),
    hasNumber: /\d/.test(pwd),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(pwd),
  });

  const passwordValidation = validatePassword(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const getPasswordStrength = (): { label: string; color: string; width: string } => {
    const checks = Object.values(passwordValidation).filter(Boolean).length;
    if (checks === 4) return { label: 'Strong', color: 'bg-green-500', width: 'w-full' };
    if (checks === 3) return { label: 'Good', color: 'bg-blue-500', width: 'w-3/4' };
    if (checks === 2) return { label: 'Fair', color: 'bg-yellow-500', width: 'w-1/2' };
    return { label: 'Weak', color: 'bg-red-500', width: 'w-1/4' };
  };

  const strength = getPasswordStrength();

  const canProceedStep1 = name && email && password && confirmPassword && passwordsMatch && agreeTerms;
  const canProceedStep2 = investmentFocus.length > 0 && experienceLevel;

  const toggleInvestmentFocus = (id: string) => {
    setInvestmentFocus(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const addMarket = () => {
    if (newMarket.trim() && !markets.includes(newMarket.trim())) {
      setMarkets([...markets, newMarket.trim()]);
      setNewMarket('');
    }
  };

  const removeMarket = (market: string) => {
    setMarkets(markets.filter(m => m !== market));
  };

  const handleSubmit = async () => {
    setError('');
    setLoading(true);

    try {
      const result = await register(email, password, name);
      if (result.success) {
        navigate('/app');
      } else {
        setError(result.error || 'Registration failed');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const renderProgressBar = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {[1, 2, 3].map((s) => (
        <div key={s} className="flex items-center">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center font-medium text-sm ${
              s <= step
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-500'
            }`}
          >
            {s < step ? <Check className="w-4 h-4" /> : s}
          </div>
          {s < 3 && (
            <div className={`w-12 h-1 mx-1 ${s < step ? 'bg-blue-600' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );

  const ValidationItem = ({ valid, label }: { valid: boolean; label: string }) => (
    <div className="flex items-center gap-2 text-sm">
      {valid ? (
        <Check className="w-4 h-4 text-green-500" />
      ) : (
        <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
      )}
      <span className={valid ? 'text-green-600' : 'text-gray-500'}>{label}</span>
    </div>
  );

  return (
    <div className="w-full">
      {renderProgressBar()}

      {step === 1 && (
        <>
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Create Your Account</h2>
            <p className="text-gray-500 text-sm">Start finding investment opportunities today</p>
          </div>

          <div className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Smith"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              {email && (
                <div className="flex items-center gap-1 mt-1 text-sm text-green-600">
                  <Check className="w-4 h-4" />
                  <span>This email is available</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {password && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Password Strength:</span>
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-full ${strength.color} ${strength.width} transition-all`} />
                    </div>
                    <span className={`text-sm font-medium ${strength.color.replace('bg-', 'text-')}`}>
                      {strength.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <ValidationItem valid={passwordValidation.minLength} label="At least 8 characters" />
                    <ValidationItem valid={passwordValidation.hasUpperLower} label="Upper & lowercase" />
                    <ValidationItem valid={passwordValidation.hasNumber} label="Contains numbers" />
                    <ValidationItem valid={passwordValidation.hasSpecial} label="Special characters" />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {confirmPassword && (
                <div className={`flex items-center gap-1 mt-1 text-sm ${passwordsMatch ? 'text-green-600' : 'text-red-500'}`}>
                  {passwordsMatch ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                  <span>{passwordsMatch ? 'Passwords match' : 'Passwords do not match'}</span>
                </div>
              )}
            </div>

            <div className="space-y-3 pt-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">
                  I agree to the <a href="#" className="text-blue-600 hover:underline">Terms of Service</a> and{' '}
                  <a href="#" className="text-blue-600 hover:underline">Privacy Policy</a>
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreeUpdates}
                  onChange={(e) => setAgreeUpdates(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">Send me product updates and investment tips</span>
              </label>
            </div>

            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!canProceedStep1}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>Continue</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Tell Us About Your Investments</h2>
            <p className="text-gray-500 text-sm">This helps us personalize your experience</p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                What's your primary investment focus? (Select all that apply)
              </label>
              <div className="grid grid-cols-2 gap-3">
                {investmentFocusOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => toggleInvestmentFocus(option.id)}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      investmentFocus.includes(option.id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                        investmentFocus.includes(option.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                      }`}>
                        {investmentFocus.includes(option.id) && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div>
                        <div className="font-medium text-gray-800 text-sm">{option.label}</div>
                        <div className="text-xs text-gray-500">{option.description}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Experience Level</label>
              <div className="space-y-2">
                {experienceLevels.map((level) => (
                  <label key={level.id} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="experience"
                      value={level.id}
                      checked={experienceLevel === level.id}
                      onChange={(e) => setExperienceLevel(e.target.value)}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{level.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Primary Investment Markets (Optional)
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newMarket}
                  onChange={(e) => setNewMarket(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addMarket())}
                  placeholder="e.g., Atlanta, GA"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={addMarket}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium"
                >
                  + Add
                </button>
              </div>
              {markets.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {markets.map((market) => (
                    <span
                      key={market}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                    >
                      {market}
                      <button onClick={() => removeMarket(market)} className="hover:text-blue-900">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={!canProceedStep2}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Continue</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Choose Your Plan</h2>
            <p className="text-gray-500 text-sm">Start with a free trial, upgrade anytime</p>
          </div>

          <div className="space-y-4">
            <div className="border-2 border-blue-500 bg-blue-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-gray-900">Jedi Core</h3>
                <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-xs font-medium">RECOMMENDED</span>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-2">
                $97<span className="text-sm font-normal text-gray-500">/month</span>
              </div>
              <ul className="text-sm text-gray-600 space-y-1">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Supply & Demand Analysis</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Price & Market Insights</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> News & Event Monitoring</li>
              </ul>
            </div>

            <div className="border border-gray-200 rounded-xl p-4">
              <h3 className="font-bold text-gray-900 mb-2">Free Trial</h3>
              <div className="text-3xl font-bold text-gray-900 mb-2">
                $0<span className="text-sm font-normal text-gray-500">/14 days</span>
              </div>
              <ul className="text-sm text-gray-600 space-y-1">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Full access to all features</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> No credit card required</li>
              </ul>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <span>Start Free Trial</span>
                )}
              </button>
            </div>
          </div>
        </>
      )}

      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600">
          Already have an account?{' '}
          <button onClick={onSwitchToLogin} className="text-blue-600 hover:text-blue-700 font-medium">
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
