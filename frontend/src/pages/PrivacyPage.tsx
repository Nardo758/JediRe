import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Shield } from 'lucide-react';

interface Section {
  id: string;
  title: string;
}

const sections: Section[] = [
  { id: 'summary', title: 'Summary' },
  { id: 'collection', title: 'Collection' },
  { id: 'usage', title: 'Usage' },
  { id: 'sharing', title: 'Sharing' },
  { id: 'storage', title: 'Storage' },
  { id: 'rights', title: 'Rights' },
  { id: 'cookies', title: 'Cookies' },
  { id: 'security', title: 'Security' },
  { id: 'children', title: 'Children' },
  { id: 'changes', title: 'Changes' },
  { id: 'contact', title: 'Contact' },
];

export default function PrivacyPage() {
  const [activeSection, setActiveSection] = useState('summary');

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 150;
      for (const section of sections) {
        const element = document.getElementById(section.id);
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      window.scrollTo({ top: element.offsetTop - 100, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <Building2 className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">JediRe - Privacy Policy</span>
            </Link>
            <span className="text-sm text-gray-500">Last updated: Feb 1, 2026</span>
          </div>
        </div>
      </header>

      <div className="pt-16 flex">
        <aside className="hidden lg:block w-64 fixed left-0 top-16 bottom-0 border-r border-gray-200 bg-gray-50 overflow-y-auto">
          <nav className="p-4">
            <h3 className="font-semibold text-gray-900 mb-4">Quick Links</h3>
            <ul className="space-y-1">
              {sections.map((section) => (
                <li key={section.id}>
                  <button
                    onClick={() => scrollToSection(section.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      activeSection === section.id
                        ? 'bg-blue-100 text-blue-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {section.title}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <main className="flex-1 lg:ml-64 px-4 sm:px-6 lg:px-8 py-8 max-w-4xl">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-gray-500 mb-8">Last Updated: February 1, 2026</p>

          <section id="summary" className="mb-12">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              Plain English Summary
            </h2>
            <ul className="space-y-2 text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-green-600">•</span>
                We collect data you provide and usage data
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600">•</span>
                We use it to provide and improve Service
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600">•</span>
                We don't sell your personal information
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600">•</span>
                You can access, export, or delete your data
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600">•</span>
                We're GDPR and CCPA compliant
              </li>
            </ul>
          </section>

          <section id="collection" className="mb-12">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              1. Information We Collect
            </h2>
            
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">Information You Provide:</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2"><span className="text-blue-600">•</span>Account info (name, email, phone)</li>
                <li className="flex items-start gap-2"><span className="text-blue-600">•</span>Payment information (via Stripe)</li>
                <li className="flex items-start gap-2"><span className="text-blue-600">•</span>Profile data (investment preferences, markets)</li>
                <li className="flex items-start gap-2"><span className="text-blue-600">•</span>Content you create (comments, annotations, notes)</li>
                <li className="flex items-start gap-2"><span className="text-blue-600">•</span>Communications with support</li>
              </ul>
            </div>

            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">Automatically Collected:</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2"><span className="text-blue-600">•</span>Usage data (features used, time spent)</li>
                <li className="flex items-start gap-2"><span className="text-blue-600">•</span>Device info (browser, OS, IP address)</li>
                <li className="flex items-start gap-2"><span className="text-blue-600">•</span>Log data (access times, errors)</li>
                <li className="flex items-start gap-2"><span className="text-blue-600">•</span>Cookies and similar technologies</li>
                <li className="flex items-start gap-2"><span className="text-blue-600">•</span>Location data (with permission)</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2">From Third Parties:</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2"><span className="text-blue-600">•</span>Public real estate data (MLS, county records)</li>
                <li className="flex items-start gap-2"><span className="text-blue-600">•</span>Market data providers</li>
                <li className="flex items-start gap-2"><span className="text-blue-600">•</span>Authentication providers (Google, LinkedIn)</li>
              </ul>
            </div>
          </section>

          <section id="usage" className="mb-12">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              2. How We Use Your Information
            </h2>
            
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">To Provide Service:</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2"><span className="text-blue-600">•</span>Create and manage your account</li>
                <li className="flex items-start gap-2"><span className="text-blue-600">•</span>Provide property analysis and insights</li>
                <li className="flex items-start gap-2"><span className="text-blue-600">•</span>Process payments</li>
                <li className="flex items-start gap-2"><span className="text-blue-600">•</span>Send notifications and alerts</li>
                <li className="flex items-start gap-2"><span className="text-blue-600">•</span>Provide customer support</li>
              </ul>
            </div>

            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">To Improve Service:</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2"><span className="text-blue-600">•</span>Analyze usage patterns</li>
                <li className="flex items-start gap-2"><span className="text-blue-600">•</span>Train and improve AI models</li>
                <li className="flex items-start gap-2"><span className="text-blue-600">•</span>Fix bugs and optimize performance</li>
                <li className="flex items-start gap-2"><span className="text-blue-600">•</span>Develop new features</li>
              </ul>
            </div>

            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">To Communicate:</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2"><span className="text-blue-600">•</span>Send service updates</li>
                <li className="flex items-start gap-2"><span className="text-blue-600">•</span>Marketing (with your consent)</li>
                <li className="flex items-start gap-2"><span className="text-blue-600">•</span>Respond to inquiries</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Legal Compliance:</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2"><span className="text-blue-600">•</span>Comply with laws and regulations</li>
                <li className="flex items-start gap-2"><span className="text-blue-600">•</span>Protect our rights and users</li>
                <li className="flex items-start gap-2"><span className="text-blue-600">•</span>Prevent fraud and abuse</li>
              </ul>
            </div>
          </section>

          <section id="sharing" className="mb-12">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              3. How We Share Your Information
            </h2>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <p className="text-green-800 font-medium">We DO NOT sell your personal information.</p>
            </div>

            <p className="text-gray-600 mb-4">We may share with:</p>

            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">Service Providers:</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2"><span className="text-gray-400">•</span>Payment processing (Stripe)</li>
                <li className="flex items-start gap-2"><span className="text-gray-400">•</span>Cloud hosting (AWS)</li>
                <li className="flex items-start gap-2"><span className="text-gray-400">•</span>Analytics (Google Analytics)</li>
                <li className="flex items-start gap-2"><span className="text-gray-400">•</span>Email service (SendGrid)</li>
                <li className="flex items-start gap-2"><span className="text-gray-400">•</span>Customer support (Intercom)</li>
              </ul>
            </div>

            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">With Your Consent:</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2"><span className="text-gray-400">•</span>Team members you invite</li>
                <li className="flex items-start gap-2"><span className="text-gray-400">•</span>Collaborators you share with</li>
                <li className="flex items-start gap-2"><span className="text-gray-400">•</span>Third-party integrations you enable</li>
              </ul>
            </div>

            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">Legal Requirements:</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2"><span className="text-gray-400">•</span>Court orders or subpoenas</li>
                <li className="flex items-start gap-2"><span className="text-gray-400">•</span>Law enforcement requests</li>
                <li className="flex items-start gap-2"><span className="text-gray-400">•</span>Protect rights, safety, or property</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Business Transfers:</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2"><span className="text-gray-400">•</span>Merger, acquisition, or sale</li>
              </ul>
            </div>
          </section>

          <section id="storage" className="mb-12">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              4. Data Storage and Security
            </h2>
            
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">Storage:</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2"><span className="text-blue-600">•</span>Data stored on secure AWS servers (US)</li>
                <li className="flex items-start gap-2"><span className="text-blue-600">•</span>Encrypted at rest and in transit (TLS 1.3)</li>
                <li className="flex items-start gap-2"><span className="text-blue-600">•</span>Regular backups</li>
                <li className="flex items-start gap-2"><span className="text-blue-600">•</span>Retained while account active + 90 days</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Security Measures:</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2"><Shield className="w-4 h-4 text-green-600 mt-0.5" />Multi-factor authentication available</li>
                <li className="flex items-start gap-2"><Shield className="w-4 h-4 text-green-600 mt-0.5" />Regular security audits</li>
                <li className="flex items-start gap-2"><Shield className="w-4 h-4 text-green-600 mt-0.5" />Employee training on data protection</li>
                <li className="flex items-start gap-2"><Shield className="w-4 h-4 text-green-600 mt-0.5" />Limited access to personal data</li>
                <li className="flex items-start gap-2"><Shield className="w-4 h-4 text-green-600 mt-0.5" />SOC 2 Type II certified</li>
              </ul>
            </div>
          </section>

          <section id="rights" className="mb-12">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              5. Your Privacy Rights
            </h2>
            
            <p className="text-gray-600 mb-4">You have the right to:</p>
            <ul className="space-y-2 text-gray-600 mb-6">
              <li className="flex items-start gap-2"><span className="text-blue-600">•</span>Access your data</li>
              <li className="flex items-start gap-2"><span className="text-blue-600">•</span>Correct inaccurate data</li>
              <li className="flex items-start gap-2"><span className="text-blue-600">•</span>Delete your data</li>
              <li className="flex items-start gap-2"><span className="text-blue-600">•</span>Export your data (portable format)</li>
              <li className="flex items-start gap-2"><span className="text-blue-600">•</span>Opt-out of marketing communications</li>
              <li className="flex items-start gap-2"><span className="text-blue-600">•</span>Restrict processing</li>
              <li className="flex items-start gap-2"><span className="text-blue-600">•</span>Object to automated decisions</li>
            </ul>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-blue-800">
                <span className="font-medium">To exercise rights:</span> privacy@jedire.com<br />
                We respond within 30 days.
              </p>
            </div>

            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">California Residents (CCPA):</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2"><span className="text-purple-600">•</span>Right to know what data we collect</li>
                <li className="flex items-start gap-2"><span className="text-purple-600">•</span>Right to delete</li>
                <li className="flex items-start gap-2"><span className="text-purple-600">•</span>Right to opt-out of sale (we don't sell)</li>
                <li className="flex items-start gap-2"><span className="text-purple-600">•</span>No discrimination for exercising rights</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2">EU Residents (GDPR):</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2"><span className="text-purple-600">•</span>All rights above plus data portability</li>
                <li className="flex items-start gap-2"><span className="text-purple-600">•</span>Right to lodge complaint with supervisory authority</li>
                <li className="flex items-start gap-2"><span className="text-purple-600">•</span>Legal basis for processing: legitimate interest, contract, consent</li>
              </ul>
            </div>
          </section>

          <section id="cookies" className="mb-12">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              6. Cookies and Tracking
            </h2>
            
            <p className="text-gray-600 mb-4">We use cookies for:</p>
            <ul className="space-y-2 text-gray-600 mb-6">
              <li className="flex items-start gap-2"><span className="text-blue-600">•</span><span className="font-medium">Essential:</span> Authentication, security, preferences</li>
              <li className="flex items-start gap-2"><span className="text-blue-600">•</span><span className="font-medium">Analytics:</span> Usage patterns, performance (Google Analytics)</li>
              <li className="flex items-start gap-2"><span className="text-blue-600">•</span><span className="font-medium">Marketing:</span> Advertising effectiveness (with consent)</li>
            </ul>
            <p className="text-gray-600">
              You can manage cookies in your browser settings. Disabling essential cookies may affect functionality.
            </p>
          </section>

          <section id="security" className="mb-12">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              7. Data Security
            </h2>
            <p className="text-gray-600 mb-4">
              We implement industry-standard security measures to protect your data. However, no system is 100% secure. 
              We encourage you to use strong passwords and enable two-factor authentication.
            </p>
            <p className="text-gray-600">
              Report security concerns to: security@jedire.com
            </p>
          </section>

          <section id="children" className="mb-12">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              8. Children's Privacy
            </h2>
            <p className="text-gray-600">
              JediRe is not intended for users under 18. We do not knowingly collect data from children. 
              If we learn we have collected data from a child, we will delete it promptly.
            </p>
          </section>

          <section id="changes" className="mb-12">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              9. Changes to This Policy
            </h2>
            <p className="text-gray-600 mb-4">
              We may update this policy from time to time. We will notify you of material changes via email 
              or in-app notification at least 30 days before they take effect.
            </p>
            <p className="text-gray-600">
              Continued use after changes indicates acceptance of the updated policy.
            </p>
          </section>

          <section id="contact" className="mb-12">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              10. Contact Us
            </h2>
            <p className="text-gray-600 mb-4">For privacy-related questions or requests:</p>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <p className="text-gray-700">
                <span className="font-medium">Privacy Team:</span> privacy@jedire.com
              </p>
              <p className="text-gray-700">
                <span className="font-medium">Data Protection Officer:</span> dpo@jedire.com
              </p>
              <p className="text-gray-700">
                <span className="font-medium">Address:</span> 100 Congress Ave, Suite 2000, Austin, TX 78701
              </p>
            </div>
          </section>

          <div className="border-t border-gray-200 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-gray-500 text-sm">
              By using JediRe, you acknowledge that you have read and agree to this Privacy Policy.
            </p>
            <div className="flex gap-4">
              <Link to="/terms" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                Terms of Service
              </Link>
              <Link to="/contact" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                Contact Us
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
