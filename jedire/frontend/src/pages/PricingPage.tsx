import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Check, X, ChevronDown, ChevronUp, Building2, Menu, Plus } from 'lucide-react';

interface PricingTier {
  name: string;
  monthlyPrice: number | null;
  annualPrice: number | null;
  description: string;
  features: string[];
  highlighted?: boolean;
  cta: string;
  ctaAction: 'trial' | 'contact';
}

interface Module {
  name: string;
  price: number;
  description: string;
}

interface FAQ {
  question: string;
  answer: string;
}

const pricingTiers: PricingTier[] = [
  {
    name: 'Starter',
    monthlyPrice: 97,
    annualPrice: 78,
    description: 'For beginners',
    features: [
      'Core Service',
      'Supply Agent',
      'Demand Agent',
      'News Agent',
      'Events Agent',
      'Price Analysis',
      '1 market',
      'Unlimited properties',
    ],
    cta: 'Try Free',
    ctaAction: 'trial',
  },
  {
    name: 'Flipper Bundle',
    monthlyPrice: 197,
    annualPrice: 158,
    description: 'For active flippers',
    highlighted: true,
    features: [
      'Everything in Starter',
      'SF Strategy Module',
      'Cash Flow Module',
      'Pro Network Access',
      '3 markets',
    ],
    cta: 'Try Free',
    ctaAction: 'trial',
  },
  {
    name: 'Investor Bundle',
    monthlyPrice: 267,
    annualPrice: 214,
    description: 'For buy-and-hold',
    features: [
      'Everything in Starter',
      'SF Strategy Module',
      'Cash Flow Module',
      'Debt Optimization',
      'Pro Network Access',
      '5 markets',
    ],
    cta: 'Try Free',
    ctaAction: 'trial',
  },
  {
    name: 'Enterprise',
    monthlyPrice: null,
    annualPrice: null,
    description: 'For funds & teams',
    features: [
      'Everything in Investor',
      'Unlimited seats',
      'White label',
      'API access',
      'Custom training',
      'Dedicated support',
      'SLA guarantee',
    ],
    cta: 'Contact Sales',
    ctaAction: 'contact',
  },
];

const modules: Module[] = [
  { name: 'SF Strategy', price: 47, description: '4-way arbitrage analysis across all strategies' },
  { name: 'Development', price: 67, description: 'Land development entitlement risk analysis' },
  { name: 'Debt Optimize', price: 37, description: 'Interest rate cycle timing optimization' },
  { name: 'Cash Flow', price: 57, description: 'Rent gap + value-add ROI optimization' },
  { name: 'Financial Model', price: 77, description: '10-year proforma Monte Carlo simulations' },
  { name: 'Event & Timing', price: 27, description: 'Fed meetings + economic calendar impact analysis' },
];

const comparisonFeatures = [
  { name: 'Core AI Agents', starter: true, flipper: true, investor: true, enterprise: true },
  { name: 'Bubble Map Interface', starter: true, flipper: true, investor: true, enterprise: true },
  { name: 'Properties per month', starter: '∞', flipper: '∞', investor: '∞', enterprise: '∞' },
  { name: 'Markets', starter: '1', flipper: '3', investor: '5', enterprise: '∞' },
  { name: 'SF Strategy Arbitrage', starter: false, flipper: true, investor: true, enterprise: true },
  { name: 'Cash Flow Optimization', starter: false, flipper: true, investor: true, enterprise: true },
  { name: 'Debt Optimization', starter: false, flipper: false, investor: true, enterprise: true },
  { name: 'Professional Network', starter: false, flipper: true, investor: true, enterprise: true },
  { name: 'Financial Modeling', starter: false, flipper: false, investor: false, enterprise: true },
  { name: 'API Access', starter: false, flipper: false, investor: false, enterprise: true },
  { name: 'Team Seats', starter: '1', flipper: '1', investor: '3', enterprise: '∞' },
  { name: 'Priority Support', starter: false, flipper: false, investor: true, enterprise: true },
  { name: 'White Label', starter: false, flipper: false, investor: false, enterprise: true },
  { name: 'SLA Guarantee', starter: false, flipper: false, investor: false, enterprise: true },
];

const faqs: FAQ[] = [
  {
    question: 'What happens after my 30-day free trial?',
    answer: 'After your trial ends, you can choose to continue with any plan. If you don\'t upgrade, your account will be paused but your data will be saved for 90 days.',
  },
  {
    question: 'Can I change plans or add modules later?',
    answer: 'Yes! You can upgrade, downgrade, or add individual modules at any time. Changes take effect immediately and billing is prorated.',
  },
  {
    question: 'What markets are available?',
    answer: 'We currently cover 50+ major US markets including Atlanta, Phoenix, Austin, Dallas, Denver, Tampa, and more. New markets are added monthly.',
  },
  {
    question: 'Do I need a credit card for the free trial?',
    answer: 'No credit card required! Start your 30-day trial with just an email address. You\'ll only be asked for payment when you\'re ready to continue.',
  },
  {
    question: 'What\'s included in the Professional Network?',
    answer: 'Access to vetted contractors, inspectors, lenders, and other real estate professionals in your markets. Get quotes, reviews, and direct connections.',
  },
  {
    question: 'Can I get a refund if I\'m not satisfied?',
    answer: 'We offer a 30-day money-back guarantee on all paid plans. If you\'re not completely satisfied, contact support for a full refund.',
  },
];

export default function PricingPage() {
  const navigate = useNavigate();
  const [isAnnual, setIsAnnual] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const formatPrice = (monthly: number | null, annual: number | null) => {
    if (monthly === null) return 'Custom';
    return `$${isAnnual ? annual : monthly}`;
  };

  const renderFeatureValue = (value: boolean | string) => {
    if (typeof value === 'string') {
      return <span className="font-medium">{value}</span>;
    }
    return value ? (
      <Check className="w-5 h-5 text-green-500 mx-auto" />
    ) : (
      <X className="w-5 h-5 text-gray-300 mx-auto" />
    );
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-b border-gray-100 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <Building2 className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">JediRe</span>
            </Link>

            <nav className="hidden md:flex items-center gap-8">
              <Link to="/#features" className="text-gray-600 hover:text-gray-900 text-sm font-medium">Features</Link>
              <Link to="/pricing" className="text-blue-600 text-sm font-medium">Pricing</Link>
              <a href="#" className="text-gray-600 hover:text-gray-900 text-sm font-medium">About</a>
              <a href="#" className="text-gray-600 hover:text-gray-900 text-sm font-medium">Blog</a>
            </nav>

            <div className="hidden md:flex items-center gap-4">
              <button
                onClick={() => navigate('/auth')}
                className="text-gray-600 hover:text-gray-900 text-sm font-medium"
              >
                Login
              </button>
              <button
                onClick={() => navigate('/auth')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
              >
                Sign Up
              </button>
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2"
            >
              <Menu className="w-6 h-6 text-gray-600" />
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 py-4">
            <div className="px-4 space-y-3">
              <Link to="/#features" className="block text-gray-600 hover:text-gray-900 font-medium">Features</Link>
              <Link to="/pricing" className="block text-blue-600 font-medium">Pricing</Link>
              <a href="#" className="block text-gray-600 hover:text-gray-900 font-medium">About</a>
              <a href="#" className="block text-gray-600 hover:text-gray-900 font-medium">Blog</a>
              <hr className="border-gray-200" />
              <button onClick={() => navigate('/auth')} className="block w-full text-left text-gray-600 font-medium">Login</button>
              <button onClick={() => navigate('/auth')} className="block w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-center">Sign Up</button>
            </div>
          </div>
        )}
      </header>

      <section className="pt-28 pb-12 bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Pay only for the modules you need
          </p>

          <div className="inline-flex items-center gap-4 bg-gray-100 rounded-full p-1">
            <button
              onClick={() => setIsAnnual(false)}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                !isAnnual ? 'bg-white shadow text-gray-900' : 'text-gray-600'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                isAnnual ? 'bg-white shadow text-gray-900' : 'text-gray-600'
              }`}
            >
              Annual - Save 20%
            </button>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {pricingTiers.map((tier, i) => (
              <div
                key={i}
                className={`rounded-2xl p-6 ${
                  tier.highlighted
                    ? 'bg-gradient-to-br from-blue-600 to-purple-600 text-white ring-4 ring-blue-200'
                    : 'bg-white border border-gray-200'
                }`}
              >
                <div className="mb-4">
                  <h3 className={`text-lg font-bold ${tier.highlighted ? 'text-white' : 'text-gray-900'}`}>
                    {tier.name}
                  </h3>
                  <p className={`text-sm ${tier.highlighted ? 'text-blue-100' : 'text-gray-500'}`}>
                    {tier.description}
                  </p>
                </div>

                <div className="mb-6">
                  <span className={`text-4xl font-bold ${tier.highlighted ? 'text-white' : 'text-gray-900'}`}>
                    {formatPrice(tier.monthlyPrice, tier.annualPrice)}
                  </span>
                  {tier.monthlyPrice !== null && (
                    <span className={`text-sm ${tier.highlighted ? 'text-blue-100' : 'text-gray-500'}`}>
                      /month
                    </span>
                  )}
                  {isAnnual && tier.monthlyPrice !== null && (
                    <div className={`text-sm mt-1 ${tier.highlighted ? 'text-blue-100' : 'text-gray-500'}`}>
                      <span className="line-through">${tier.monthlyPrice}</span>
                      <span className="ml-2 text-green-400 font-medium">Save 20%</span>
                    </div>
                  )}
                </div>

                <ul className="space-y-3 mb-6">
                  {tier.features.map((feature, j) => (
                    <li key={j} className="flex items-start gap-2">
                      <Check className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                        tier.highlighted ? 'text-blue-200' : 'text-green-500'
                      }`} />
                      <span className={`text-sm ${tier.highlighted ? 'text-white' : 'text-gray-600'}`}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => navigate('/auth')}
                  className={`w-full py-3 rounded-lg font-medium transition-colors ${
                    tier.highlighted
                      ? 'bg-white text-blue-600 hover:bg-gray-100'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {tier.cta}
                </button>
              </div>
            ))}
          </div>

          <p className="text-center text-gray-500 mt-8">
            💡 All plans include 30-day free trial • No credit card required
          </p>
        </div>
      </section>

      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Or Build Your Own Custom Plan
            </h2>
            <p className="text-gray-600">
              All modules require Jedi Core base service - $97/mo
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {modules.map((module, i) => (
              <div key={i} className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">{module.name}</h3>
                  <span className="text-xl font-bold text-blue-600">${module.price}<span className="text-sm text-gray-500 font-normal">/mo</span></span>
                </div>
                <p className="text-gray-600 text-sm mb-4">{module.description}</p>
                <button className="w-full py-2 border border-blue-600 text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" /> Add Module
                </button>
              </div>
            ))}
          </div>

          <div className="text-center mt-8">
            <button className="text-blue-600 hover:text-blue-700 font-medium">
              View All 12 Modules →
            </button>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            Feature Comparison
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-4 px-4 font-medium text-gray-600">Feature</th>
                  <th className="text-center py-4 px-4 font-medium text-gray-600">Starter</th>
                  <th className="text-center py-4 px-4 font-medium text-blue-600 bg-blue-50 rounded-t-lg">Flipper</th>
                  <th className="text-center py-4 px-4 font-medium text-gray-600">Investor</th>
                  <th className="text-center py-4 px-4 font-medium text-gray-600">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {comparisonFeatures.map((feature, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-4 px-4 text-gray-900">{feature.name}</td>
                    <td className="py-4 px-4 text-center">{renderFeatureValue(feature.starter)}</td>
                    <td className="py-4 px-4 text-center bg-blue-50">{renderFeatureValue(feature.flipper)}</td>
                    <td className="py-4 px-4 text-center">{renderFeatureValue(feature.investor)}</td>
                    <td className="py-4 px-4 text-center">{renderFeatureValue(feature.enterprise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="py-16 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            Frequently Asked Questions
          </h2>

          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left"
                >
                  <span className="font-medium text-gray-900">{faq.question}</span>
                  {expandedFaq === i ? (
                    <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  )}
                </button>
                {expandedFaq === i && (
                  <div className="px-6 pb-4 text-gray-600">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-br from-blue-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to Start Finding Better Deals?</h2>
          <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
            Join 5,000+ investors using AI to uncover hidden opportunities.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate('/auth')}
              className="px-8 py-4 bg-white text-blue-600 hover:bg-gray-100 rounded-xl font-semibold text-lg"
            >
              Start Free 30-Day Trial
            </button>
            <button className="px-8 py-4 bg-white/10 hover:bg-white/20 border border-white/30 rounded-xl font-semibold text-lg">
              Schedule a Demo
            </button>
          </div>
        </div>
      </section>

      <footer className="py-12 bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-6 h-6 text-blue-500" />
                <span className="text-lg font-bold text-white">JediRe</span>
              </div>
              <p className="text-sm">AI-Powered Real Estate Intelligence</p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">Features</a></li>
                <li><Link to="/pricing" className="hover:text-white">Pricing</Link></li>
                <li><a href="#" className="hover:text-white">API</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">About</a></li>
                <li><a href="#" className="hover:text-white">Blog</a></li>
                <li><a href="#" className="hover:text-white">Careers</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">Privacy</a></li>
                <li><a href="#" className="hover:text-white">Terms</a></li>
                <li><a href="#" className="hover:text-white">Security</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-sm text-center">
            © 2026 JediRe. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
