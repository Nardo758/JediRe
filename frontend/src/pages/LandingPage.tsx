import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Search, Play, Target, Bot, BarChart3, Map, Users, Zap, 
  Menu, X, ChevronRight, TrendingUp, Building2, DollarSign
} from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const stats = [
    { value: '2,847', label: 'Properties Analyzed' },
    { value: '$847M+', label: 'Opportunities Found' },
    { value: '24', label: 'Markets Tracked' },
    { value: '12', label: 'AI Agents Active' },
  ];

  const features = [
    {
      icon: Target,
      title: 'Strategy Arbitrage',
      description: 'Compare all 4 strategies on every property instantly',
    },
    {
      icon: Bot,
      title: 'AI Agents Ecosystem',
      description: '12+ autonomous agents analyzing supply, demand, news, events',
    },
    {
      icon: BarChart3,
      title: 'Arbitrage Detection',
      description: 'Find 15%+ ROI spreads between strategies that others miss',
    },
    {
      icon: Map,
      title: 'Interactive Bubble Map',
      description: 'Visual scoring shows best opportunities at a glance',
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-b border-gray-100 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">JR</span>
              </div>
              <div className="text-2xl font-bold">
                <span className="text-emerald-500">Jedi</span><span className="text-gray-900">Re</span>
              </div>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-8">
              <Link to="/features" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">
                Discover
              </Link>
              <Link to="/pricing" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">
                Analyst Studio
              </Link>
              <Link to="/about" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">
                Markets
              </Link>
              <Link to="/docs" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">
                API
              </Link>
              <Link to="/pricing" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">
                Pricing
              </Link>
            </nav>

            {/* Desktop Auth */}
            <div className="hidden md:flex items-center gap-4">
              <button
                onClick={() => navigate('/auth')}
                className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate('/auth')}
                className="px-5 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Get Started
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6 text-gray-600" />
              ) : (
                <Menu className="w-6 h-6 text-gray-600" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 py-4">
            <div className="px-4 space-y-3">
              <Link to="/features" className="block text-gray-600 hover:text-gray-900 font-medium py-2">Discover</Link>
              <Link to="/pricing" className="block text-gray-600 hover:text-gray-900 font-medium py-2">Analyst Studio</Link>
              <Link to="/about" className="block text-gray-600 hover:text-gray-900 font-medium py-2">Markets</Link>
              <Link to="/docs" className="block text-gray-600 hover:text-gray-900 font-medium py-2">API</Link>
              <Link to="/pricing" className="block text-gray-600 hover:text-gray-900 font-medium py-2">Pricing</Link>
              <hr className="border-gray-200" />
              <button onClick={() => navigate('/auth')} className="block w-full text-left text-gray-600 font-medium py-2">
                Sign In
              </button>
              <button onClick={() => navigate('/auth')} className="block w-full px-4 py-2 bg-gray-900 text-white rounded-lg font-medium text-center">
                Get Started
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Stats Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-full mb-8">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-emerald-700">
              2,847+ Properties Analyzed This Month
            </span>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-start">
            {/* Left Column - Hero Content */}
            <div>
              <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                Transform Property Data into{' '}
                <span className="text-emerald-500">Investment Opportunities</span>
              </h1>
              
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Discover validated real estate opportunities backed by AI-powered 
                analysis. From autonomous agents to expert insights—everything you 
                need to invest smarter.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-wrap gap-4 mb-12">
                <button
                  onClick={() => navigate('/auth')}
                  className="px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-lg font-medium transition-colors inline-flex items-center gap-2"
                >
                  <Target className="w-5 h-5" />
                  Find Opportunities
                </button>
                <button
                  className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors inline-flex items-center gap-2"
                >
                  <Map className="w-5 h-5" />
                  Explore Markets
                </button>
                <button className="px-6 py-3 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 rounded-lg font-medium transition-colors inline-flex items-center gap-2">
                  <Play className="w-5 h-5" />
                  Watch Demo
                </button>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                {stats.map((stat, i) => (
                  <div key={i}>
                    <div className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</div>
                    <div className="text-sm text-gray-600">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column - Featured Opportunity Card */}
            <div className="lg:pl-8">
              <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
                {/* Badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full mb-4">
                  <Zap className="w-4 h-4 text-gray-600" />
                  <span className="text-xs font-medium text-gray-700">UNLOCK THIS WEEK'S TOP OPPORTUNITY</span>
                </div>

                {/* Opportunity Title */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">
                      Multifamily Development Site in Growing Austin Submarket
                    </h3>
                    <p className="text-sm text-gray-600">
                      847 property validations at 4.8/5 severity reveal massive arbitrage 
                      opportunity in emerging development zone
                    </p>
                  </div>
                  <div className="ml-4 flex-shrink-0">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                      <span className="text-2xl font-bold text-white">92</span>
                    </div>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <div className="text-xs text-gray-500 uppercase mb-1">Market Size</div>
                    <div className="text-lg font-bold text-gray-900">$12M-$18M</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase mb-1">Validations</div>
                    <div className="text-lg font-bold text-gray-900">847</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase mb-1">Growth</div>
                    <div className="text-lg font-bold text-emerald-600">+38%</div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600" style={{ width: '92%' }} />
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    <TrendingUp className="w-3 h-3 text-emerald-600" />
                    <span className="text-xs text-emerald-600 font-medium">+38% monthly growth</span>
                  </div>
                </div>

                {/* CTA */}
                <button className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-lg font-medium transition-colors inline-flex items-center justify-center gap-2">
                  See More Opportunities
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Small Users Badge */}
              <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                <Users className="w-4 h-4" />
                <span>1,247 investors tracking this market</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section - Dark Background */}
      <section className="py-20 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full mb-8">
            <Zap className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium text-white">Featured Tools</span>
          </div>

          <h2 className="text-4xl font-bold text-white mb-4">
            AI-Powered Investment Analysis
          </h2>
          <p className="text-xl text-gray-400 mb-12 max-w-3xl">
            Get investor-ready analysis in minutes. Generate comprehensive feasibility 
            studies, market analyses, and strategic assessments powered by AI.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {features.map((feature, i) => (
              <div
                key={i}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-colors"
              >
                <div className="w-12 h-12 bg-emerald-500/10 rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>

          {/* Sample Report Card */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border border-white/10 p-8">
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 rounded-full mb-4">
                  <Building2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-medium text-emerald-400">Sample Analysis</span>
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">
                  Complete Market Analysis
                </h3>
                <p className="text-gray-400 mb-6">
                  Generate comprehensive property assessments including market sizing, 
                  growth projections, competitive analysis, and ROI calculations.
                </p>
                <div className="flex flex-wrap gap-3 mb-6">
                  {['Feasibility Study', 'Market Analysis', 'SWOT', 'PESTLE', 'Pitch Deck'].map((tag) => (
                    <span key={tag} className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-medium text-gray-300">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex gap-4">
                  <button className="px-6 py-3 bg-white hover:bg-gray-100 text-gray-900 rounded-lg font-medium transition-colors inline-flex items-center gap-2">
                    <Play className="w-4 h-4" />
                    See Examples
                  </button>
                  <button className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg font-medium transition-colors">
                    Try Free Sample
                  </button>
                </div>
              </div>

              <div className="bg-gray-900/50 rounded-xl border border-white/10 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-emerald-400">Property Report</div>
                    <div className="text-xs text-gray-500">Generated Analysis</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Market Size (TAM)</span>
                    <span className="text-sm font-bold text-white">$8.2B</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Growth Rate</span>
                    <span className="text-sm font-bold text-emerald-400">+24% YoY</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Competition Level</span>
                    <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-400 rounded text-xs font-medium">Medium</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Confidence Score</span>
                    <span className="text-sm font-bold text-white">87%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Ready to Find Your Next Investment?
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Join 5,000+ investors who are already using AI to find better deals faster.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate('/auth')}
              className="px-8 py-4 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-semibold text-lg transition-colors inline-flex items-center gap-2"
            >
              Start Free Trial
              <ChevronRight className="w-5 h-5" />
            </button>
            <button className="px-8 py-4 bg-white hover:bg-gray-50 border-2 border-gray-900 text-gray-900 rounded-xl font-semibold text-lg transition-colors">
              Schedule Demo
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-gray-50 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">JR</span>
                </div>
                <div className="text-lg font-bold">
                  <span className="text-emerald-500">Jedi</span><span className="text-gray-900">Re</span>
                </div>
              </div>
              <p className="text-sm text-gray-600">AI-Powered Real Estate Intelligence</p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><Link to="/features" className="hover:text-gray-900">Features</Link></li>
                <li><Link to="/pricing" className="hover:text-gray-900">Pricing</Link></li>
                <li><Link to="/docs" className="hover:text-gray-900">API</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><Link to="/about" className="hover:text-gray-900">About</Link></li>
                <li><Link to="/blog" className="hover:text-gray-900">Blog</Link></li>
                <li><Link to="/careers" className="hover:text-gray-900">Careers</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><Link to="/privacy" className="hover:text-gray-900">Privacy</Link></li>
                <li><Link to="/terms" className="hover:text-gray-900">Terms</Link></li>
                <li><Link to="/security" className="hover:text-gray-900">Security</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-200 pt-8 text-sm text-gray-600 text-center">
            © 2026 JediRe. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
