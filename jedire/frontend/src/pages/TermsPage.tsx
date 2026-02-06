import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Building2 } from 'lucide-react';

interface Section {
  id: string;
  title: string;
}

const sections: Section[] = [
  { id: 'summary', title: 'Summary' },
  { id: 'agreement', title: 'Acceptance' },
  { id: 'services', title: 'Services' },
  { id: 'accounts', title: 'Accounts' },
  { id: 'payment', title: 'Payment' },
  { id: 'content', title: 'Content' },
  { id: 'prohibited', title: 'Prohibited' },
  { id: 'warranty', title: 'Warranty' },
  { id: 'limitation', title: 'Limitation' },
  { id: 'indemnification', title: 'Indemnification' },
  { id: 'termination', title: 'Termination' },
  { id: 'contact', title: 'Contact' },
];

export default function TermsPage() {
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
              <span className="text-xl font-bold text-gray-900">JediRe - Terms of Service</span>
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">JediRe Terms of Service</h1>
          <p className="text-gray-500 mb-8">
            Last Updated: February 1, 2026 • Effective Date: February 1, 2026
          </p>

          <section id="summary" className="mb-12">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              Plain English Summary (Not Legally Binding)
            </h2>
            <ul className="space-y-2 text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                You must be 18+ to use JediRe
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                We provide real estate analysis tools, not investment advice
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                You're responsible for your investment decisions
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                We can modify or discontinue features with notice
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                Cancel anytime, no penalties
              </li>
            </ul>
          </section>

          <section id="agreement" className="mb-12">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              1. Acceptance of Terms
            </h2>
            <p className="text-gray-600 mb-4">
              By accessing or using JediRe ("Service"), you agree to be bound by these Terms of Service ("Terms").
            </p>
            <p className="text-gray-600">
              If you do not agree to these Terms, do not use the Service.
            </p>
          </section>

          <section id="services" className="mb-12">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              2. Description of Service
            </h2>
            <p className="text-gray-600 mb-4">JediRe provides:</p>
            <ul className="space-y-2 text-gray-600 mb-4">
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                AI-powered real estate market analysis
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                Property investment opportunity scoring
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                Strategy arbitrage analysis
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                Market intelligence and data visualization
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                Collaboration and sharing tools
              </li>
            </ul>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800 font-medium">
                JediRe is a TOOL, not a licensed investment advisor or real estate broker. All investment decisions are solely your responsibility.
              </p>
            </div>
          </section>

          <section id="accounts" className="mb-12">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              3. User Accounts
            </h2>
            <ul className="space-y-2 text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                You must be 18+ to create an account
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                You are responsible for account security
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                One person per account (no sharing)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                Provide accurate registration information
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                Notify us of unauthorized access immediately
              </li>
            </ul>
          </section>

          <section id="payment" className="mb-12">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              4. Subscription and Payment
            </h2>
            <ul className="space-y-2 text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                Subscriptions auto-renew monthly or annually
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                Prices may change with 30-day notice
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                Cancel anytime (effective next billing cycle)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                Refunds available within 30 days if unsatisfied
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                No refunds for partial billing periods
              </li>
            </ul>
          </section>

          <section id="content" className="mb-12">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              5. Data and Content
            </h2>
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">Your Content:</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">•</span>
                  You own content you upload
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">•</span>
                  You grant us license to provide Service
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">•</span>
                  You're responsible for content you share
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Our Content:</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">•</span>
                  Data, analysis, and insights remain our property
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">•</span>
                  No scraping or automated data extraction
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">•</span>
                  API available for authorized integrations
                </li>
              </ul>
            </div>
          </section>

          <section id="prohibited" className="mb-12">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              6. Prohibited Uses
            </h2>
            <p className="text-gray-600 mb-4">You may NOT:</p>
            <ul className="space-y-2 text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-red-600">•</span>
                Violate laws or regulations
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600">•</span>
                Share accounts or credentials
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600">•</span>
                Scrape or copy our data
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600">•</span>
                Reverse engineer our software
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600">•</span>
                Create competing services using our data
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600">•</span>
                Misrepresent yourself or your affiliation
              </li>
            </ul>
          </section>

          <section id="warranty" className="mb-12">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              7. Disclaimer of Warranties
            </h2>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-red-800 font-medium">
                IMPORTANT: Service provided "AS IS"
              </p>
            </div>
            <ul className="space-y-2 text-gray-600 mb-4">
              <li className="flex items-start gap-2">
                <span className="text-gray-400">•</span>
                No guarantee of accuracy or completeness
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-400">•</span>
                No guarantee of profitability
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-400">•</span>
                Market data may contain errors or delays
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-400">•</span>
                AI predictions are estimates, not guarantees
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-400">•</span>
                Not a substitute for professional advice
              </li>
            </ul>
            <p className="text-gray-600">
              Always verify information independently and consult licensed professionals before making investment decisions.
            </p>
          </section>

          <section id="limitation" className="mb-12">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              8. Limitation of Liability
            </h2>
            <p className="text-gray-600 mb-4">
              JediRe's total liability limited to amount you paid in the 12 months before the claim.
            </p>
            <p className="text-gray-600 mb-2">We are NOT liable for:</p>
            <ul className="space-y-2 text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-gray-400">•</span>
                Investment losses
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-400">•</span>
                Data errors or omissions
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-400">•</span>
                Service interruptions
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-400">•</span>
                Third-party data accuracy
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-400">•</span>
                Consequential or indirect damages
              </li>
            </ul>
          </section>

          <section id="indemnification" className="mb-12">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              9. Indemnification
            </h2>
            <p className="text-gray-600">
              You agree to indemnify JediRe from claims arising from your use of the Service or violation of Terms.
            </p>
          </section>

          <section id="termination" className="mb-12">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              10. Termination
            </h2>
            <p className="text-gray-600 mb-4">Either party may terminate at any time.</p>
            <p className="text-gray-600 mb-2">We may suspend/terminate for:</p>
            <ul className="space-y-2 text-gray-600 mb-4">
              <li className="flex items-start gap-2">
                <span className="text-gray-400">•</span>
                Terms violations
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-400">•</span>
                Fraudulent activity
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-400">•</span>
                Non-payment
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-400">•</span>
                At our discretion with notice
              </li>
            </ul>
            <p className="text-gray-600 mb-2">Upon termination:</p>
            <ul className="space-y-2 text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-gray-400">•</span>
                Access ends immediately
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-400">•</span>
                You may export your data within 30 days
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-400">•</span>
                We may delete your data after 90 days
              </li>
            </ul>
          </section>

          <section id="contact" className="mb-12">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              11. Contact Information
            </h2>
            <p className="text-gray-600 mb-4">For questions about these Terms, contact us:</p>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <p className="text-gray-700">
                <span className="font-medium">Email:</span> legal@jedire.com
              </p>
              <p className="text-gray-700">
                <span className="font-medium">Address:</span> 100 Congress Ave, Suite 2000, Austin, TX 78701
              </p>
              <p className="text-gray-700">
                <span className="font-medium">Phone:</span> 1-800-JEDIRE (1-800-533-4731)
              </p>
            </div>
          </section>

          <div className="border-t border-gray-200 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-gray-500 text-sm">
              By using JediRe, you acknowledge that you have read and agree to these Terms.
            </p>
            <div className="flex gap-4">
              <Link to="/privacy" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                Privacy Policy
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
