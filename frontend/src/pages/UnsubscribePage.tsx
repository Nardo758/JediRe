import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Building2, Mail, Check, ChevronRight } from 'lucide-react';

export default function UnsubscribePage() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || 'your@email.com';
  const [submitted, setSubmitted] = useState(false);
  const [preferences, setPreferences] = useState({
    marketing: true,
    productUpdates: true,
    weeklyDigest: true,
    propertyAlerts: true,
    teamActivity: true,
  });

  const togglePref = (key: keyof typeof preferences) => {
    setPreferences({ ...preferences, [key]: !preferences[key] });
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Preferences Updated</h1>
        <p className="text-gray-600 mb-8 text-center">
          Your email preferences have been saved. Changes may take up to 24 hours to take effect.
        </p>
        <Link to="/" className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
          Return to JediRe <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Link to="/" className="flex items-center gap-2">
              <Building2 className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">JediRe</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl p-8 border border-gray-200">
          <div className="text-center mb-8">
            <Mail className="w-12 h-12 text-blue-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Email Preferences</h1>
            <p className="text-gray-600">
              Managing preferences for <strong>{email}</strong>
            </p>
          </div>

          <div className="space-y-4 mb-8">
            {[
              { key: 'marketing', label: 'Marketing & Promotions', desc: 'Special offers, tips, and product news' },
              { key: 'productUpdates', label: 'Product Updates', desc: 'New features and improvements' },
              { key: 'weeklyDigest', label: 'Weekly Digest', desc: 'Summary of activity and insights' },
              { key: 'propertyAlerts', label: 'Property Alerts', desc: 'Notifications about saved properties and alerts' },
              { key: 'teamActivity', label: 'Team Activity', desc: 'Updates from team members and collaborators' },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <h3 className="font-medium text-gray-900">{item.label}</h3>
                  <p className="text-sm text-gray-500">{item.desc}</p>
                </div>
                <button
                  onClick={() => togglePref(item.key as keyof typeof preferences)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    preferences[item.key as keyof typeof preferences] ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      preferences[item.key as keyof typeof preferences] ? 'translate-x-6' : ''
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => setSubmitted(true)}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
            >
              Save Preferences
            </button>
            <button
              onClick={() => {
                setPreferences({
                  marketing: false,
                  productUpdates: false,
                  weeklyDigest: false,
                  propertyAlerts: false,
                  teamActivity: false,
                });
              }}
              className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Unsubscribe from All
            </button>
          </div>

          <p className="text-sm text-gray-500 mt-6 text-center">
            Note: You will still receive transactional emails related to your account.
          </p>
        </div>
      </main>
    </div>
  );
}
