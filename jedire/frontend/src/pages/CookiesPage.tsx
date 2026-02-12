import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ArrowLeft, Cookie, Check, X } from 'lucide-react';

export default function CookiesPage() {
  const [preferences, setPreferences] = useState({
    essential: true,
    analytics: true,
    marketing: false,
    preferences: true,
  });

  const togglePreference = (key: keyof typeof preferences) => {
    if (key === 'essential') return;
    setPreferences({ ...preferences, [key]: !preferences[key] });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Link to="/" className="text-gray-400 hover:text-gray-600 mr-4">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Cookie className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">Cookie Preferences</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl p-6 border border-gray-200 mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Manage Cookie Preferences</h1>
          <p className="text-gray-600 mb-6">
            We use cookies to improve your experience on our website. You can manage your preferences below.
            Essential cookies cannot be disabled as they are required for the website to function.
          </p>

          <div className="space-y-4">
            {[
              { key: 'essential', title: 'Essential Cookies', desc: 'Required for the website to function properly. Cannot be disabled.', required: true },
              { key: 'analytics', title: 'Analytics Cookies', desc: 'Help us understand how visitors interact with our website.', required: false },
              { key: 'marketing', title: 'Marketing Cookies', desc: 'Used to track visitors across websites for advertising purposes.', required: false },
              { key: 'preferences', title: 'Preference Cookies', desc: 'Remember your settings and preferences for a better experience.', required: false },
            ].map((cookie) => (
              <div key={cookie.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <h3 className="font-medium text-gray-900">{cookie.title}</h3>
                  <p className="text-sm text-gray-500">{cookie.desc}</p>
                </div>
                <button
                  onClick={() => togglePreference(cookie.key as keyof typeof preferences)}
                  disabled={cookie.required}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    preferences[cookie.key as keyof typeof preferences]
                      ? 'bg-blue-600'
                      : 'bg-gray-300'
                  } ${cookie.required ? 'cursor-not-allowed opacity-60' : ''}`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      preferences[cookie.key as keyof typeof preferences] ? 'translate-x-6' : ''
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-4 mt-6">
            <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
              Save Preferences
            </button>
            <button
              onClick={() => setPreferences({ essential: true, analytics: true, marketing: true, preferences: true })}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Accept All
            </button>
            <button
              onClick={() => setPreferences({ essential: true, analytics: false, marketing: false, preferences: false })}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Reject Non-Essential
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h2 className="font-semibold text-gray-900 mb-4">About Our Cookies</h2>
          <div className="prose prose-sm text-gray-600">
            <p className="mb-4">
              Cookies are small text files stored on your device when you visit our website. 
              They help us provide you with a better experience by remembering your preferences 
              and understanding how you use our site.
            </p>
            <p className="mb-4">
              For more information about how we use your data, please see our{' '}
              <Link to="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>.
            </p>
            <p>
              If you have questions about our cookie practices, please{' '}
              <Link to="/contact" className="text-blue-600 hover:underline">contact us</Link>.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
