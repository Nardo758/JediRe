import { Link } from 'react-router-dom';
import { Building2, ArrowLeft, Accessibility, Check, Mail } from 'lucide-react';

export default function AccessibilityPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Link to="/" className="text-gray-400 hover:text-gray-600 mr-4">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Accessibility className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">Accessibility Statement</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl p-8 border border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Accessibility Statement</h1>
          <p className="text-sm text-gray-500 mb-8">Last updated: February 1, 2026</p>

          <div className="prose prose-gray max-w-none">
            <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">Our Commitment</h2>
            <p className="text-gray-600 mb-4">
              JediRe is committed to ensuring digital accessibility for people with disabilities. 
              We are continually improving the user experience for everyone and applying the relevant 
              accessibility standards.
            </p>

            <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">Conformance Status</h2>
            <p className="text-gray-600 mb-4">
              We aim to conform to the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA. 
              These guidelines explain how to make web content more accessible for people with disabilities.
            </p>

            <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">Accessibility Features</h2>
            <ul className="space-y-3 mb-8">
              {[
                'Keyboard navigation support throughout the application',
                'Screen reader compatibility with ARIA labels',
                'High contrast mode support',
                'Resizable text without loss of functionality',
                'Alt text for all meaningful images',
                'Focus indicators for interactive elements',
                'Consistent navigation structure',
                'Error identification and suggestions',
              ].map((feature, i) => (
                <li key={i} className="flex items-start gap-3 text-gray-600">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>

            <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">Known Limitations</h2>
            <p className="text-gray-600 mb-4">
              While we strive for comprehensive accessibility, some areas of our site may still 
              present challenges. We are actively working to address these issues:
            </p>
            <ul className="list-disc list-inside text-gray-600 mb-8 space-y-2">
              <li>Some third-party embedded content may not be fully accessible</li>
              <li>Certain complex data visualizations may require additional context</li>
              <li>Older PDF documents may not be fully accessible</li>
            </ul>

            <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">Feedback</h2>
            <p className="text-gray-600 mb-4">
              We welcome your feedback on the accessibility of JediRe. Please let us know if you 
              encounter accessibility barriers:
            </p>
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100 mb-8">
              <p className="text-gray-700 mb-2">
                <strong>Email:</strong> accessibility@jedire.com
              </p>
              <p className="text-gray-700">
                <strong>Response time:</strong> We aim to respond within 5 business days
              </p>
            </div>

            <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">Technical Specifications</h2>
            <p className="text-gray-600 mb-4">
              JediRe is designed to work with the following assistive technologies:
            </p>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-2">
              <li>JAWS (Windows)</li>
              <li>NVDA (Windows)</li>
              <li>VoiceOver (macOS/iOS)</li>
              <li>TalkBack (Android)</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
