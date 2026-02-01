import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Search, Play, Check, X, Target, Bot, BarChart3, Map, Users, Zap, 
  ArrowRight, Star, ChevronRight, Menu, Building2
} from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    {
      icon: Users,
      title: 'Professional Network',
      description: 'Expert validation from contractors and professionals',
    },
    {
      icon: Zap,
      title: 'Real-Time Intelligence',
      description: 'Live market updates every 15 minutes',
    },
  ];

  const problems = [
    "You're looking at properties one strategy at a time",
    "Missing 18% average ROI spreads between strategies",
    "Spending hours on manual analysis per property",
    "Flying blind without real-time market intelligence",
    "Relying on gut feeling instead of data",
  ];

  const solutions = [
    "Analyze ALL strategies instantly (Build/Flip/Rental/Airbnb)",
    "Find arbitrage opportunities automatically",
    "2-minute comprehensive analysis vs 2-hour manual work",
    "Real-time AI agents monitoring 12+ market factors",
    "Data-driven decisions with 95% AI confidence",
  ];

  const steps = [
    {
      number: 1,
      title: 'Set Your Criteria',
      description: 'Tell us your markets, budget, and investment goals',
    },
    {
      number: 2,
      title: 'AI Agents Analyze Markets',
      description: '12+ agents scan properties 24/7 across all strategies',
    },
    {
      number: 3,
      title: 'Find Hidden Opportunities',
      description: 'Get alerts for arbitrage opportunities others miss',
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <header className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-b border-gray-100 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Building2 className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">JediRe</span>
            </div>

            <nav className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-gray-600 hover:text-gray-900 text-sm font-medium">Features</a>
              <Link to="/pricing" className="text-gray-600 hover:text-gray-900 text-sm font-medium">Pricing</Link>
              <a href="#about" className="text-gray-600 hover:text-gray-900 text-sm font-medium">About</a>
              <a href="#blog" className="text-gray-600 hover:text-gray-900 text-sm font-medium">Blog</a>
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
              <a href="#features" className="block text-gray-600 hover:text-gray-900 font-medium">Features</a>
              <Link to="/pricing" className="block text-gray-600 hover:text-gray-900 font-medium">Pricing</Link>
              <a href="#about" className="block text-gray-600 hover:text-gray-900 font-medium">About</a>
              <a href="#blog" className="block text-gray-600 hover:text-gray-900 font-medium">Blog</a>
              <hr className="border-gray-200" />
              <button onClick={() => navigate('/auth')} className="block w-full text-left text-gray-600 font-medium">Login</button>
              <button onClick={() => navigate('/auth')} className="block w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-center">Sign Up</button>
            </div>
          </div>
        )}
      </header>

      <section className="pt-24 pb-16 bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
              Find Your Next Investment Opportunity{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                With AI-Powered Intelligence
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Stop guessing. Start investing smarter with autonomous AI agents that analyze every property 
              across 4 investment strategies to find hidden arbitrage opportunities others miss.
            </p>

            <div className="max-w-xl mx-auto mb-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder='Enter your target market... e.g., "Atlanta, GA"'
                  className="w-full pl-12 pr-28 py-4 border border-gray-300 rounded-xl text-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                />
                <button className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
                  Search
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
              <button
                onClick={() => navigate('/auth')}
                className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-lg flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25"
              >
                🚀 Start Free 30-Day Trial
              </button>
              <button className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 rounded-xl font-semibold text-lg flex items-center justify-center gap-2">
                <Play className="w-5 h-5" />
                Watch 2-Min Demo
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
              <span className="flex items-center gap-1"><Check className="w-4 h-4 text-green-500" /> No credit card required</span>
              <span className="flex items-center gap-1"><Check className="w-4 h-4 text-green-500" /> Cancel anytime</span>
              <span className="flex items-center gap-1"><Check className="w-4 h-4 text-green-500" /> Full access</span>
            </div>

            <div className="mt-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 shadow-2xl">
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
                {[92, 88, 85, 79, 75].map((score, i) => (
                  <div
                    key={i}
                    className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-white font-bold text-sm sm:text-lg shadow-lg ${
                      score >= 90 ? 'bg-green-500' : score >= 80 ? 'bg-blue-500' : 'bg-yellow-500'
                    }`}
                    style={{ animationDelay: `${i * 0.1}s` }}
                  >
                    {score}
                  </div>
                ))}
              </div>
              <p className="text-white/80 text-sm mt-4">Interactive Bubble Map Preview</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 bg-gray-50 border-y border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-gray-600 mb-8">
            Trusted by <span className="font-semibold">5,000+</span> investors who've found <span className="font-semibold">$2.4B</span> in opportunities
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12 opacity-60">
            {['Forbes', 'TechCrunch', 'WSJ', 'RE Investor'].map((logo) => (
              <div key={logo} className="text-xl sm:text-2xl font-bold text-gray-400">{logo}</div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-2 mt-8">
            <div className="flex">
              {[1,2,3,4,5].map((i) => (
                <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
              ))}
            </div>
            <span className="text-gray-600 font-medium">4.9/5 from 1,247 reviews</span>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">
                The Problem with Traditional RE Investing
              </h2>
              <div className="space-y-4">
                {problems.map((problem, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <X className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-600">{problem}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">
                The JediRe Solution
              </h2>
              <div className="space-y-4">
                {solutions.map((solution, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-600">{solution}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              What Makes JediRe Different
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Our AI-powered platform gives you an unfair advantage in real estate investing
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600 mb-4">{feature.description}</p>
                <a href="#" className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center gap-1">
                  Learn More <ChevronRight className="w-4 h-4" />
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Get Started in 3 Simple Steps
            </h2>
          </div>

          <div className="max-w-3xl mx-auto">
            {steps.map((step, i) => (
              <div key={i} className="relative">
                <div className="flex items-start gap-6 mb-8">
                  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                    {step.number}
                  </div>
                  <div className="flex-1 bg-gray-50 rounded-xl p-6">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{step.title}</h3>
                    <p className="text-gray-600">{step.description}</p>
                  </div>
                </div>
                {i < steps.length - 1 && (
                  <div className="absolute left-6 top-14 w-0.5 h-8 bg-blue-200" />
                )}
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <button
              onClick={() => navigate('/auth')}
              className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-lg inline-flex items-center gap-2 shadow-lg"
            >
              Start Your Free Trial <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      <section id="pricing" className="py-20 bg-gradient-to-br from-blue-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to Find Hidden Opportunities?</h2>
          <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
            Join 5,000+ investors who are already using AI to find better deals faster.
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
                <li><a href="#" className="hover:text-white">Pricing</a></li>
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
