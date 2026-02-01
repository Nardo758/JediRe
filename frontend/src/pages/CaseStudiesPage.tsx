import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, Menu, Star, ChevronRight, Play, Quote } from 'lucide-react';

interface CaseStudy {
  id: string;
  category: string;
  name: string;
  title: string;
  subtitle: string;
  description: string;
  stats: { value: string; label: string }[];
  featured?: boolean;
  quote?: string;
  challenge?: string;
  solution?: string;
  keyWins?: string[];
}

const categories = ['All', 'Flippers', 'Rental Investors', 'Developers', 'Funds'];

const caseStudies: CaseStudy[] = [
  {
    id: '1',
    category: 'Flippers',
    name: 'Sarah Johnson',
    title: 'How Sarah Built a $2.1M Portfolio in 18 Months Using Strategy Arbitrage',
    subtitle: 'Active Flipper → Portfolio Investor • Atlanta, GA • 18 months with JediRe',
    description: '',
    challenge: 'Sarah was an active flipper doing 8-10 deals per year with decent returns (15-20% ROI). She wanted to scale but didn\'t have time to analyze more properties manually.',
    solution: 'Using strategy arbitrage analysis, Sarah discovered that 40% of properties she was flipping would generate higher long-term returns as rentals. She shifted strategy on key properties.',
    keyWins: [
      'Found 23 properties with >15% arbitrage opportunities',
      'Built 12-property rental portfolio while continuing to flip',
      'Increased overall ROI from 18% to 31%',
      'Reduced analysis time from 3 hours to 15 minutes per property',
    ],
    stats: [
      { value: '$2.1M', label: 'Portfolio Value' },
      { value: '23', label: 'Properties Acquired' },
      { value: '31%', label: 'Avg ROI' },
      { value: '$42K', label: 'Extra Profit Per Deal' },
    ],
    quote: 'JediRe showed me I was leaving money on the table. The strategy arbitrage feature alone has generated an extra $400K in value I would have completely missed.',
    featured: true,
  },
  {
    id: '2',
    category: 'Funds',
    name: 'Mike Chen',
    title: 'From $5M to $24M AUM in 2 Years',
    subtitle: 'Chen Capital • Real Estate Fund',
    description: 'How Chen Capital used JediRe to identify undervalued properties at scale',
    stats: [
      { value: '$24M', label: 'AUM' },
      { value: '67', label: 'Properties/Week' },
      { value: '28%', label: 'Avg IRR' },
    ],
  },
  {
    id: '3',
    category: 'Developers',
    name: 'David Park',
    title: 'Finding Entitled Land Before the Market',
    subtitle: 'Park Development Group • Land Developer',
    description: 'Development Agent identified 12 pre-approved parcels saving 18 months of entitlement work',
    stats: [
      { value: '$3.2M', label: 'Saved in Entitlement' },
      { value: '18mo', label: 'Timeline Reduction' },
      { value: '4', label: 'Projects Underway' },
    ],
  },
  {
    id: '4',
    category: 'Rental Investors',
    name: 'Lisa Martinez',
    title: 'Converted 8 Rentals to STRs, Doubled NOI',
    subtitle: 'Independent Investor • Airbnb Operator',
    description: 'Cash Flow Agent identified rent gap arbitrage between traditional rental and Airbnb',
    stats: [
      { value: '$127K', label: 'Additional Annual NOI' },
      { value: '8', label: 'Conversions' },
      { value: '92%', label: 'Avg Occupancy' },
    ],
  },
  {
    id: '5',
    category: 'Flippers',
    name: 'Robert Williams',
    title: 'From Weekend Warrior to Full-Time Flipper',
    subtitle: 'Independent Flipper • Dallas, TX',
    description: 'AI agents helped identify off-market opportunities and reduce due diligence time by 80%',
    stats: [
      { value: '24', label: 'Deals Closed' },
      { value: '$890K', label: 'Total Profit' },
      { value: '22%', label: 'Avg ROI' },
    ],
  },
  {
    id: '6',
    category: 'Rental Investors',
    name: 'Jennifer Lee',
    title: 'Building Cash Flow in Rising Rate Environment',
    subtitle: 'Family Office • Multi-Family Focus',
    description: 'Used debt analysis to find properties with assumable mortgages at below-market rates',
    stats: [
      { value: '$4.8M', label: 'Portfolio Value' },
      { value: '2.1%', label: 'Below Market Rate' },
      { value: '$156K', label: 'Annual Cash Flow' },
    ],
  },
];

const aggregateStats = [
  { value: '$2.4B+', label: 'Total Deal Value' },
  { value: '5,000+', label: 'Active Investors' },
  { value: '18%', label: 'Avg ROI Increase' },
  { value: '95%', label: 'Success Rate' },
];

export default function CaseStudiesPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');

  const featuredStudy = caseStudies.find(cs => cs.featured);
  const otherStudies = caseStudies.filter(cs => !cs.featured);
  
  const filteredStudies = otherStudies.filter(study => 
    selectedCategory === 'All' || study.category === selectedCategory
  );

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Flippers': 'bg-green-100 text-green-700',
      'Rental Investors': 'bg-blue-100 text-blue-700',
      'Developers': 'bg-purple-100 text-purple-700',
      'Funds': 'bg-orange-100 text-orange-700',
    };
    return colors[category] || 'bg-gray-100 text-gray-700';
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
              <Link to="/features" className="text-gray-600 hover:text-gray-900 text-sm font-medium">Features</Link>
              <Link to="/pricing" className="text-gray-600 hover:text-gray-900 text-sm font-medium">Pricing</Link>
              <Link to="/about" className="text-gray-600 hover:text-gray-900 text-sm font-medium">About</Link>
              <Link to="/blog" className="text-gray-600 hover:text-gray-900 text-sm font-medium">Blog</Link>
            </nav>

            <div className="hidden md:flex items-center gap-4">
              <button onClick={() => navigate('/auth')} className="text-gray-600 hover:text-gray-900 text-sm font-medium">Login</button>
              <button onClick={() => navigate('/auth')} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">Sign Up</button>
            </div>

            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2">
              <Menu className="w-6 h-6 text-gray-600" />
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 py-4">
            <div className="px-4 space-y-3">
              <Link to="/features" className="block text-gray-600 hover:text-gray-900 font-medium">Features</Link>
              <Link to="/pricing" className="block text-gray-600 hover:text-gray-900 font-medium">Pricing</Link>
              <Link to="/about" className="block text-gray-600 hover:text-gray-900 font-medium">About</Link>
              <Link to="/blog" className="block text-gray-600 hover:text-gray-900 font-medium">Blog</Link>
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
            Real Investors, Real Results
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            See how investors are using JediRe to find opportunities worth millions
          </p>
        </div>
      </section>

      <section className="py-4 border-b border-gray-200 sticky top-16 bg-white z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === category
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </section>

      {featuredStudy && selectedCategory === 'All' && (
        <section className="py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl p-6 sm:p-8 border border-yellow-200">
              <div className="flex items-center gap-2 mb-6">
                <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                <span className="text-sm font-bold text-yellow-700 uppercase tracking-wide">Featured Success Story</span>
              </div>

              <div className="flex flex-col lg:flex-row gap-8">
                <div className="lg:w-1/3">
                  <div className="aspect-square bg-gradient-to-br from-blue-400 to-purple-500 rounded-xl flex items-center justify-center max-w-xs mx-auto lg:mx-0">
                    <span className="text-6xl font-bold text-white">SJ</span>
                  </div>
                  <div className="mt-4 text-center lg:text-left">
                    <h3 className="font-semibold text-gray-900">{featuredStudy.name}</h3>
                    <p className="text-sm text-gray-600">{featuredStudy.subtitle}</p>
                  </div>
                </div>

                <div className="lg:w-2/3">
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">
                    {featuredStudy.title}
                  </h2>

                  <div className="space-y-4 mb-6">
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">The Challenge:</h4>
                      <p className="text-gray-600">{featuredStudy.challenge}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">The JediRe Solution:</h4>
                      <p className="text-gray-600">{featuredStudy.solution}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">Key Wins:</h4>
                      <ul className="list-disc list-inside text-gray-600 space-y-1">
                        {featuredStudy.keyWins?.map((win, i) => (
                          <li key={i}>{win}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                    {featuredStudy.stats.map((stat, i) => (
                      <div key={i} className="bg-white rounded-xl p-4 text-center border border-yellow-200">
                        <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                        <div className="text-xs text-gray-500">{stat.label}</div>
                      </div>
                    ))}
                  </div>

                  {featuredStudy.quote && (
                    <div className="bg-white/60 rounded-xl p-4 mb-6 border border-yellow-200">
                      <Quote className="w-6 h-6 text-yellow-500 mb-2" />
                      <p className="text-gray-700 italic mb-2">"{featuredStudy.quote}"</p>
                      <p className="text-sm font-medium text-gray-900">- {featuredStudy.name}</p>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2">
                      Read Full Case Study <ChevronRight className="w-4 h-4" />
                    </button>
                    <button className="px-6 py-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-medium flex items-center justify-center gap-2">
                      <Play className="w-4 h-4" /> Watch Video Testimonial
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            {selectedCategory === 'All' ? 'More Success Stories' : selectedCategory}
          </h2>
          
          <div className="space-y-6">
            {filteredStudies.map((study) => (
              <div key={study.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
                <div className="flex flex-col sm:flex-row">
                  <div className="sm:w-40 h-32 sm:h-auto bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center flex-shrink-0">
                    <span className="text-3xl font-bold text-white">
                      {study.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <div className="p-6 flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getCategoryColor(study.category)}`}>
                        {study.category.toUpperCase()}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{study.title}</h3>
                    <p className="text-sm text-gray-500 mb-3">{study.subtitle}</p>
                    <p className="text-gray-600 text-sm mb-4">{study.description}</p>
                    
                    <div className="flex flex-wrap gap-4 mb-4">
                      {study.stats.map((stat, i) => (
                        <div key={i} className="text-center">
                          <div className="text-lg font-bold text-blue-600">{stat.value}</div>
                          <div className="text-xs text-gray-500">{stat.label}</div>
                        </div>
                      ))}
                    </div>

                    <button className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1">
                      Read Case Study <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredStudies.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No case studies found for this category.
            </div>
          )}

          <div className="text-center mt-8">
            <button className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 mx-auto">
              View All Case Studies <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      <section className="py-16 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold mb-8 text-center">Aggregate Results</h2>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {aggregateStats.map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl sm:text-4xl font-bold mb-1">{stat.value}</div>
                <div className="text-blue-100 text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Ready to Write Your Success Story?</h2>
          <p className="text-gray-600 text-lg mb-8">
            Join thousands of investors who are finding hidden opportunities with JediRe.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate('/auth')}
              className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-lg"
            >
              Start Free Trial
            </button>
            <Link
              to="/contact"
              className="px-8 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-lg"
            >
              Talk to Sales
            </Link>
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
                <li><Link to="/features" className="hover:text-white">Features</Link></li>
                <li><Link to="/pricing" className="hover:text-white">Pricing</Link></li>
                <li><Link to="/case-studies" className="hover:text-white">Case Studies</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/about" className="hover:text-white">About</Link></li>
                <li><Link to="/blog" className="hover:text-white">Blog</Link></li>
                <li><Link to="/contact" className="hover:text-white">Contact</Link></li>
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
