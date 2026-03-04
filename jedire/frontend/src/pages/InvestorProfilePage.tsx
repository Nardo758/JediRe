import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ArrowLeft, User, ChevronRight, Check, DollarSign, Target, Clock, MapPin } from 'lucide-react';

export default function InvestorProfilePage() {
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState({
    experience: '',
    goals: [] as string[],
    budget: '',
    timeline: '',
    markets: [] as string[],
    strategies: [] as string[],
    riskTolerance: 'moderate',
  });

  const toggleArrayItem = (field: 'goals' | 'markets' | 'strategies', value: string) => {
    setProfile(prev => ({
      ...prev,
      [field]: prev[field].includes(value) 
        ? prev[field].filter(v => v !== value)
        : [...prev[field], value]
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Link to="/settings" className="text-gray-400 hover:text-gray-600 mr-4">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <User className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">Investor Profile</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${
                step >= s ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {step > s ? <Check className="w-4 h-4" /> : s}
              </div>
              {s < 4 && <div className={`w-16 sm:w-24 h-1 ${step > s ? 'bg-blue-600' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Your Experience Level</h2>
            <div className="space-y-3">
              {[
                { value: 'beginner', label: 'Beginner', desc: 'New to real estate investing' },
                { value: 'intermediate', label: 'Intermediate', desc: '1-5 properties owned/flipped' },
                { value: 'experienced', label: 'Experienced', desc: '5+ properties, established investor' },
                { value: 'professional', label: 'Professional', desc: 'Full-time investor or syndicator' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setProfile({ ...profile, experience: opt.value })}
                  className={`w-full p-4 rounded-lg border text-left ${
                    profile.experience === opt.value ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-medium text-gray-900">{opt.label}</div>
                  <div className="text-sm text-gray-500">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Investment Goals</h2>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {['Cash Flow', 'Appreciation', 'Tax Benefits', 'Passive Income', 'Wealth Building', 'Portfolio Diversification'].map(goal => (
                <button
                  key={goal}
                  onClick={() => toggleArrayItem('goals', goal)}
                  className={`p-3 rounded-lg border text-sm font-medium ${
                    profile.goals.includes(goal) ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-700'
                  }`}
                >
                  {profile.goals.includes(goal) && <Check className="w-4 h-4 inline mr-1" />}
                  {goal}
                </button>
              ))}
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Investment Budget</label>
                <select
                  id="investor-budget"
                  name="investorBudget"
                  aria-label="Investment budget range"
                  value={profile.budget}
                  onChange={(e) => setProfile({ ...profile, budget: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select budget range</option>
                  <option value="under100k">Under $100K</option>
                  <option value="100k-250k">$100K - $250K</option>
                  <option value="250k-500k">$250K - $500K</option>
                  <option value="500k-1m">$500K - $1M</option>
                  <option value="over1m">Over $1M</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Investment Timeline</label>
                <select
                  id="investor-timeline"
                  name="investorTimeline"
                  aria-label="Investment timeline"
                  value={profile.timeline}
                  onChange={(e) => setProfile({ ...profile, timeline: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select timeline</option>
                  <option value="immediate">Ready to invest now</option>
                  <option value="3months">Within 3 months</option>
                  <option value="6months">Within 6 months</option>
                  <option value="1year">Within 1 year</option>
                  <option value="exploring">Just exploring</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Preferred Markets & Strategies</h2>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">Target Markets</label>
              <div className="grid grid-cols-2 gap-2">
                {['Austin, TX', 'Dallas, TX', 'Houston, TX', 'San Antonio, TX', 'Phoenix, AZ', 'Nashville, TN'].map(market => (
                  <button
                    key={market}
                    onClick={() => toggleArrayItem('markets', market)}
                    className={`p-3 rounded-lg border text-sm ${
                      profile.markets.includes(market) ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200'
                    }`}
                  >
                    <MapPin className="w-4 h-4 inline mr-1" />
                    {market}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Preferred Strategies</label>
              <div className="grid grid-cols-2 gap-2">
                {['Buy & Hold', 'Fix & Flip', 'BRRRR', 'Airbnb/STR', 'Wholesale', 'New Construction'].map(strategy => (
                  <button
                    key={strategy}
                    onClick={() => toggleArrayItem('strategies', strategy)}
                    className={`p-3 rounded-lg border text-sm ${
                      profile.strategies.includes(strategy) ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200'
                    }`}
                  >
                    {strategy}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Risk Tolerance</h2>
            <div className="space-y-3 mb-8">
              {[
                { value: 'conservative', label: 'Conservative', desc: 'Prefer stable, lower returns with minimal risk' },
                { value: 'moderate', label: 'Moderate', desc: 'Balance of risk and reward' },
                { value: 'aggressive', label: 'Aggressive', desc: 'Higher risk for potentially higher returns' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setProfile({ ...profile, riskTolerance: opt.value })}
                  className={`w-full p-4 rounded-lg border text-left ${
                    profile.riskTolerance === opt.value ? 'border-blue-600 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <div className="font-medium text-gray-900">{opt.label}</div>
                  <div className="text-sm text-gray-500">{opt.desc}</div>
                </button>
              ))}
            </div>
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <h3 className="font-medium text-green-800 mb-2">Profile Complete!</h3>
              <p className="text-sm text-green-700">
                Based on your profile, we'll personalize property recommendations and insights for you.
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-between mt-6">
          <button
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 disabled:opacity-50"
          >
            Back
          </button>
          <button
            onClick={() => step < 4 ? setStep(step + 1) : null}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2"
          >
            {step === 4 ? 'Save Profile' : 'Continue'} <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </main>
    </div>
  );
}
