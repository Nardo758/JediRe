import { Link } from 'react-router-dom';
import { Building2, ArrowLeft, MapIcon } from 'lucide-react';

const siteMap = [
  {
    category: 'Product',
    links: [
      { name: 'Features', path: '/features' },
      { name: 'Pricing', path: '/pricing' },
      { name: 'Integrations', path: '/integrations-marketplace' },
      { name: 'API Documentation', path: '/docs' },
      { name: 'Changelog', path: '/changelog' },
      { name: 'Status', path: '/status' },
    ]
  },
  {
    category: 'Company',
    links: [
      { name: 'About Us', path: '/about' },
      { name: 'Careers', path: '/careers' },
      { name: 'Press & Media', path: '/press' },
      { name: 'Contact', path: '/contact' },
      { name: 'Partner Program', path: '/partner-portal' },
    ]
  },
  {
    category: 'Resources',
    links: [
      { name: 'Blog', path: '/blog' },
      { name: 'Case Studies', path: '/case-studies' },
      { name: 'Market Reports', path: '/market-reports' },
      { name: 'Academy', path: '/academy' },
      { name: 'Webinars', path: '/webinars' },
      { name: 'Help Center', path: '/help' },
    ]
  },
  {
    category: 'Community',
    links: [
      { name: 'Forum', path: '/community' },
      { name: 'Success Stories', path: '/success-stories' },
      { name: 'Partner Directory', path: '/partner-directory' },
      { name: 'Referral Program', path: '/referral' },
      { name: 'Reviews', path: '/reviews' },
    ]
  },
  {
    category: 'Legal',
    links: [
      { name: 'Terms of Service', path: '/terms' },
      { name: 'Privacy Policy', path: '/privacy' },
      { name: 'Security', path: '/security' },
      { name: 'Cookie Policy', path: '/cookies' },
      { name: 'Accessibility', path: '/accessibility' },
      { name: 'DMCA', path: '/dmca' },
    ]
  },
  {
    category: 'Account',
    links: [
      { name: 'Sign In', path: '/auth' },
      { name: 'Sign Up', path: '/auth' },
      { name: 'Dashboard', path: '/app' },
      { name: 'Settings', path: '/settings' },
      { name: 'Billing', path: '/billing' },
    ]
  },
];

export default function SitemapPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Link to="/" className="text-gray-400 hover:text-gray-600 mr-4">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <MapIcon className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">Sitemap</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Sitemap</h1>
          <p className="text-gray-600">Find all pages on JediRe</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {siteMap.map((section, i) => (
            <div key={i}>
              <h2 className="font-bold text-gray-900 mb-4 text-lg">{section.category}</h2>
              <ul className="space-y-2">
                {section.links.map((link, j) => (
                  <li key={j}>
                    <Link to={link.path} className="text-blue-600 hover:text-blue-700 hover:underline">
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
