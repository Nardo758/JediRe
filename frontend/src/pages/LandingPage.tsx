import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Search, Play, Target, Bot, BarChart3, Map, Users, Zap, 
  Menu, X, ChevronRight, TrendingUp, Building2, DollarSign, Home, Sparkles
} from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const stats = [
    { value: '12+', label: 'AI Agents Working' },
    { value: '24/7', label: 'Market Monitoring' },
    { value: '4', label: 'Investment Strategies' },
    { value: '15%+', label: 'ROI Opportunities' },
  ];

  const features = [
    {
      icon: Target,
      title: 'Multi-Strategy Analysis',
      description: 'Instantly compare Build, Flip, Rental, and Airbnb strategies on every property',
    },
    {
      icon: Bot,
      title: 'Autonomous AI Agents',
      description: 'Supply, demand, pricing, zoning, and market intelligence—all automated',
    },
    {
      icon: Sparkles,
      title: 'Arbitrage Detection',
      description: 'Find hidden 15%+ ROI spreads between strategies others miss',
    },
    {
      icon: Map,
      title: 'Visual Property Scoring',
      description: 'Interactive bubble map shows best opportunities at a glance',
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
                Features
              </Link>
              <Link to="/pricing" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">
                Pricing
              </Link>
              <Link to="/about" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">
                Markets
              </Link>
              <Link to="/docs" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">
                Resources
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
              <Link to="/features" className="block text-gray-600 hover:text-gray-900 font-medium py-2">Features</Link>
              <Link to="/pricing" className="block text-gray-600 hover:text-gray-900 font-medium py-2">Pricing</Link>
              <Link to="/about" className="block text-gray-600 hover:text-gray-900 font-medium py-2">Markets</Link>
              <Link to="/docs" className="block text-gray-600 hover:text-gray-900 font-medium py-2">Resources</Link>
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
              12 AI Agents Analyzing Markets Right Now
            </span>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-start">
            {/* Left Column - Hero Content */}
            <div>
              <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                The Operating System for{' '}
                <span className="text-emerald-500">Real Estate Professionals</span>
              </h1>
              
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                One platform. Every strategy. Powered by 12 autonomous AI agents analyzing 
                Build, Flip, Rental, and Airbnb opportunities across your entire market—24/7.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-wrap gap-4 mb-12">
                <button
                  onClick={() => navigate('/auth')}
                  className="px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-lg font-medium transition-colors inline-flex items-center gap-2"
                >
                  <Zap className="w-5 h-5" />
                  Start Free Trial
                </button>
                <button
                  onClick={() => navigate('/auth')}
                  className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors inline-flex items-center gap-2"
                >
                  <Map className="w-5 h-5" />
                  See Live Demo
                </button>
                <button className="px-6 py-3 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 rounded-lg font-medium transition-colors inline-flex items-center gap-2">
                  <Play className="w-5 h-5" />
                  Watch Video
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

            {/* Right Column - Featured Property Card */}
            <div className="lg:pl-8">
              <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
                {/* Badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full mb-4">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-medium text-gray-700">ARBITRAGE OPPORTUNITY DETECTED</span>
                </div>

                {/* Property Info */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">
                      0.8 Acre Development Site, East Austin
                    </h3>
                    <p className="text-sm text-gray-600">
                      Zoned MF-4, perfect for 24-unit multifamily. Current owner unaware of 
                      recent upzoning—18% arbitrage opportunity vs comparable developments.
                    </p>
                  </div>
                  <div className="ml-4 flex-shrink-0">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                      <span className="text-2xl font-bold text-white">94</span>
                    </div>
                  </div>
                </div>

                {/* Strategy Comparison */}
                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">🏗️ Build (24 units)</span>
                    <span className="font-bold text-emerald-600">23% ROI</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">🔨 Fix & Flip</span>
                    <span className="font-bold text-gray-900">12% ROI</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">🏠 Long-term Rental</span>
                    <span className="font-bold text-gray-900">8% ROI</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">✈️ Airbnb</span>
                    <span className="font-bold text-gray-900">5% ROI</span>
                  </div>
                </div>

                {/* AI Insights */}
                <div className="bg-emerald-50 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-2">
                    <Bot className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-emerald-800">
                      <strong>AI Insight:</strong> Zoning agent detected recent MF-3 → MF-4 
                      change. Supply agent shows 89% occupancy in 1-mile radius. Price agent 
                      confirms 15% below comps.
                    </div>
                  </div>
                </div>

                {/* CTA */}
                <button className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-lg font-medium transition-colors inline-flex items-center justify-center gap-2">
                  View Full Analysis
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Small Users Badge */}
              <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                <Users className="w-4 h-4" />
                <span>487 investors watching Austin market</span>
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
            <span className="text-sm font-medium text-white">How It Works</span>
          </div>

          <h2 className="text-4xl font-bold text-white mb-4">
            Stop Guessing. Start Analyzing.
          </h2>
          <p className="text-xl text-gray-400 mb-12 max-w-3xl">
            Traditional investors analyze one strategy at a time, missing massive ROI spreads. 
            JediRe compares all four strategies simultaneously with AI-powered market intelligence.
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

          {/* The Problem vs Solution */}
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-8">
              <h3 className="text-xl font-bold text-white mb-4">❌ Traditional Approach</h3>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-1">•</span>
                  <span>Analyze one strategy at a time (Build OR Flip OR Rental)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-1">•</span>
                  <span>Miss 18% average ROI spreads between strategies</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-1">•</span>
                  <span>2+ hours of manual research per property</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-1">•</span>
                  <span>Outdated market data, no real-time intelligence</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-1">•</span>
                  <span>Gut feeling decisions, not data-driven</span>
                </li>
              </ul>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-8">
              <h3 className="text-xl font-bold text-white mb-4">✅ The JediRe Way</h3>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-1">•</span>
                  <span>Compare ALL 4 strategies instantly on every property</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-1">•</span>
                  <span>Auto-detect arbitrage opportunities with 15%+ ROI spreads</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-1">•</span>
                  <span>2-minute AI analysis vs 2-hour manual work</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-1">•</span>
                  <span>12+ AI agents monitoring markets 24/7 in real-time</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-1">•</span>
                  <span>Data-driven decisions with 95% AI confidence scores</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* User Types Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Built for Every Real Estate Professional
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Whether you invest, develop, broker, syndicate, or lend—JediRe adapts to your workflow
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Investors */}
            <div className="bg-gray-50 rounded-xl p-6 border-2 border-transparent hover:border-emerald-500 transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-emerald-500 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Investors</h3>
              </div>
              <ul className="space-y-3 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>Single-family arbitrage across Build, Flip, Rental, Airbnb</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>Opportunity scoring and deal prioritization</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>Market timing signals from debt cycle and supply agents</span>
                </li>
              </ul>
            </div>

            {/* Developers */}
            <div className="bg-gray-50 rounded-xl p-6 border-2 border-transparent hover:border-emerald-500 transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-emerald-500 rounded-lg flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Developers</h3>
              </div>
              <ul className="space-y-3 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>AI-powered zoning interpretation</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>Feasibility analysis and buildable envelope calculations</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>5-year supply pipeline forecasting</span>
                </li>
              </ul>
            </div>

            {/* Brokers & Agents */}
            <div className="bg-gray-50 rounded-xl p-6 border-2 border-transparent hover:border-emerald-500 transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-emerald-500 rounded-lg flex items-center justify-center">
                  <Home className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Brokers & Agents</h3>
              </div>
              <ul className="space-y-3 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>Market intelligence to advise investor clients</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>Off-market opportunity identification</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>Data-backed listing presentations</span>
                </li>
              </ul>
            </div>

            {/* Syndicators & Fund Managers */}
            <div className="bg-gray-50 rounded-xl p-6 border-2 border-transparent hover:border-emerald-500 transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-emerald-500 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Syndicators & Fund Managers</h3>
              </div>
              <ul className="space-y-3 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>Deal flow scoring and filtering</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>Portfolio-level risk monitoring</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>Investor reporting with AI-generated insights</span>
                </li>
              </ul>
            </div>

            {/* Lenders & Capital Partners */}
            <div className="bg-gray-50 rounded-xl p-6 border-2 border-transparent hover:border-emerald-500 transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-emerald-500 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Lenders & Capital Partners</h3>
              </div>
              <ul className="space-y-3 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>Automated due diligence support</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>Market validation for underwriting</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>Risk assessment across strategies</span>
                </li>
              </ul>
            </div>

            {/* All Professionals - CTA Card */}
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-6 text-white flex flex-col justify-center items-center text-center">
              <Sparkles className="w-12 h-12 mb-4" />
              <h3 className="text-xl font-bold mb-2">Your Role Not Listed?</h3>
              <p className="text-emerald-50 text-sm mb-4">
                JediRe adapts to any real estate workflow. See how it fits yours.
              </p>
              <button
                onClick={() => navigate('/auth')}
                className="px-6 py-3 bg-white text-emerald-600 rounded-lg font-semibold hover:bg-emerald-50 transition-colors"
              >
                Start Free Trial
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Ready to Find Your Next Deal?
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Join investors using AI to discover arbitrage opportunities in real-time.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate('/auth')}
              className="px-8 py-4 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-semibold text-lg transition-colors inline-flex items-center gap-2"
            >
              Start Free 30-Day Trial
              <ChevronRight className="w-5 h-5" />
            </button>
            <button className="px-8 py-4 bg-white hover:bg-gray-50 border-2 border-gray-900 text-gray-900 rounded-xl font-semibold text-lg transition-colors">
              See Live Analysis
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-4">No credit card required • Cancel anytime • Full access</p>
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
              <p className="text-sm text-gray-600">AI-Powered Real Estate Arbitrage Intelligence</p>
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
