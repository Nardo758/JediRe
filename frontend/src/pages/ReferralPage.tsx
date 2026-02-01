import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ArrowLeft, Gift, Copy, Check, Share2, DollarSign, Users, Trophy } from 'lucide-react';

const referrals = [
  { name: 'John Doe', email: 'j***@gmail.com', status: 'subscribed', reward: 50, date: 'Jan 15, 2026' },
  { name: 'Sarah Smith', email: 's***@company.com', status: 'subscribed', reward: 50, date: 'Jan 10, 2026' },
  { name: 'Mike Johnson', email: 'm***@email.com', status: 'pending', reward: 0, date: 'Jan 20, 2026' },
];

export default function ReferralPage() {
  const [copied, setCopied] = useState(false);
  const referralCode = 'JEDIRE-ABC123';
  const referralLink = `https://jedire.com/signup?ref=${referralCode}`;

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Link to="/settings" className="text-gray-400 hover:text-gray-600 mr-4">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Gift className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">Referral Program</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-8 text-white mb-8">
          <div className="text-center">
            <Gift className="w-12 h-12 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Earn $50 for Every Referral</h2>
            <p className="text-white/80 mb-6">
              Share JediRe with friends and earn rewards when they subscribe
            </p>
            <div className="bg-white/10 rounded-lg p-4 max-w-md mx-auto">
              <p className="text-sm text-white/60 mb-2">Your referral link</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={referralLink}
                  className="flex-1 bg-white/20 border-0 rounded px-3 py-2 text-white text-sm"
                />
                <button
                  onClick={copyLink}
                  className="px-4 py-2 bg-white text-blue-600 rounded font-medium flex items-center gap-2"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl p-6 border border-gray-200 text-center">
            <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">3</div>
            <div className="text-sm text-gray-500">Total Referrals</div>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-200 text-center">
            <Trophy className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">2</div>
            <div className="text-sm text-gray-500">Successful</div>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-200 text-center">
            <DollarSign className="w-8 h-8 text-purple-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">$100</div>
            <div className="text-sm text-gray-500">Total Earned</div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Your Referrals</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {referrals.map((ref, i) => (
              <div key={i} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{ref.name}</p>
                  <p className="text-sm text-gray-500">{ref.email}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    ref.status === 'subscribed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {ref.status}
                  </span>
                  {ref.reward > 0 && (
                    <span className="text-green-600 font-semibold">+${ref.reward}</span>
                  )}
                  <span className="text-sm text-gray-500">{ref.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-4">How It Works</h3>
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3 text-blue-600 font-bold">1</div>
              <h4 className="font-medium text-gray-900 mb-1">Share Your Link</h4>
              <p className="text-sm text-gray-500">Send your unique referral link to friends</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3 text-blue-600 font-bold">2</div>
              <h4 className="font-medium text-gray-900 mb-1">They Subscribe</h4>
              <p className="text-sm text-gray-500">Your friend signs up for a paid plan</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3 text-blue-600 font-bold">3</div>
              <h4 className="font-medium text-gray-900 mb-1">You Earn $50</h4>
              <p className="text-sm text-gray-500">Get credited after their first month</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
