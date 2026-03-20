import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Building2, Menu, Star, Map, Bot, BarChart3, Users, Zap, 
  TrendingUp, Globe, ChevronRight, Check, ArrowRight, Target
} from 'lucide-react';

type FeatureCategory = 'core' | 'strategy' | 'market' | 'collaboration';

interface Feature {
  icon: React.ElementType;
  title: string;
  description: string;
  bullets: string[];
  category: FeatureCategory;
}

const features: Feature[] = [
  {
    icon: Map,
    title: 'Interactive Bubble Map',
    description: 'Visual Intelligence at a Glance',
    bullets: [
      'Bubble size = opportunity score (0-100)',
      'Color = optimal strategy',
      'Pulsing ring = arbitrage opportunity',
      'Instant filtering and search',
      'Powered by Mapbox with satellite imagery',
    ],
    category: 'core',
  },
  {
    icon: Bot,
    title: 'AI Agent Ecosystem',
    description: '12+ Autonomous Agents Working 24/7',
    bullets: [
      'Supply Agent → Tracks inventory, pipeline, absorption',
      'Demand Agent → Population, jobs, migration trends',
      'News Agent → Sentiment analysis, market impact',
      'Event Agent → Fed meetings, elections, infrastructure',
      'SF Strategy Agent → 4-way arbitrage analysis',
      'Cash Flow Agent → Rent gaps, value-add opportunities',
    ],
    category: 'core',
  },
  {
    icon: BarChart3,
    title: 'Financial Modeling',
    description: 'Institutional-Grade Analysis',
    bullets: [
      '10-year cash flow projections',
      'Monte Carlo simulations (1,000 scenarios)',
      'Sensitivity analysis (what-if modeling)',
      'IRR, NPV, cash-on-cash returns',
      'Debt service coverage ratios',
      'Exit strategy analysis',
    ],
    category: 'strategy',
  },
  {
    icon: Target,
    title: 'Strategy Comparison',
    description: 'Side-by-Side Analysis',
    bullets: [
      'Build-to-Sell projections',
      'Flip & Renovate scenarios',
      'Buy-and-Hold Rental analysis',
      'Short-Term Rental (Airbnb) modeling',
      'Arbitrage opportunity detection',
      'Risk-adjusted returns',
    ],
    category: 'strategy',
  },
  {
    icon: TrendingUp,
    title: 'Market Intelligence',
    description: 'Real-Time Market Data',
    bullets: [
      'Live inventory tracking',
      'Days-on-market trends',
      'Price per square foot analysis',
      'Neighborhood appreciation rates',
      'Rental yield comparisons',
      'Supply/demand indicators',
    ],
    category: 'market',
  },
  {
    icon: Globe,
    title: 'Multi-Market Coverage',
    description: '50+ Major US Markets',
    bullets: [
      'Atlanta, Phoenix, Austin, Dallas',
      'Denver, Tampa, Charlotte, Nashville',
      'New markets added monthly',
      'Cross-market comparison tools',
      'Migration pattern tracking',
      'Job growth correlation',
    ],
    category: 'market',
  },
  {
    icon: Users,
    title: 'Professional Network',
    description: 'AI + Human Intelligence',
    bullets: [
      'Credibility-scored contractor feedback',
      'Local broker insights',
      'Property manager validation',
      '"War mapping" for service providers',
      'Direct contact with verified pros',
    ],
    category: 'collaboration',
  },
  {
    icon: Zap,
    title: 'Real-Time Collaboration',
    description: 'Team-Based Analysis',
    bullets: [
      'Live cursors showing team activity',
      'Shared sessions and annotations',
      'Comment threads on properties',
      'Pin properties for team review',
      'Export and share analysis reports',
    ],
    category: 'collaboration',
  },
];

const categories = [
  { id: 'core' as FeatureCategory, label: 'Core Intelligence' },
  { id: 'strategy' as FeatureCategory, label: 'Strategy Analysis' },
  { id: 'market' as FeatureCategory, label: 'Market Insights' },
  { id: 'collaboration' as FeatureCategory, label: 'Collaboration' },
];

const agentDetails = [
  { name: 'Supply Agent', description: 'Tracks inventory, pipeline, absorption', confidence: 94 },
  { name: 'Demand Agent', description: 'Population, jobs, migration trends', confidence: 91 },
  { name: 'News Agent', description: 'Sentiment analysis, market impact', confidence: 87 },
  { name: 'Event Agent', description: 'Fed meetings, elections, infrastructure', confidence: 89 },
  { name: 'SF Strategy Agent', description: '4-way arbitrage analysis', confidence: 96 },
  { name: 'Cash Flow Agent', description: 'Rent gaps, value-add opportunities', confidence: 93 },
  { name: 'Debt Agent', description: 'Interest rate cycles, timing', confidence: 88 },
  { name: 'Development Agent', description: 'Entitlement risk, zoning', confidence: 85 },
];

export default function FeaturesPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<FeatureCategory>('core');

  const filteredFeatures = features.filter(f => f.category === activeCategory);

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
              <Link to="/features" className="text-blue-600 text-sm font-medium">Features</Link>
              <Link to="/pricing" className="text-gray-600 hover:text-gray-900 text-sm font-medium">Pricing</Link>
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
              <Link to="/features" className="block text-blue-600 font-medium">Features</Link>
              <Link to="/pricing" className="block text-gray-600 hover:text-gray-900 font-medium">Pricing</Link>
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
            AI-Powered Features That Find{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              Hidden Opportunities
            </span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            The only platform analyzing all investment strategies at once
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate('/auth')}
              className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-lg flex items-center gap-2"
            >
              🚀 Start Free Trial
            </button>
            <button className="px-8 py-4 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 rounded-xl font-semibold text-lg flex items-center gap-2">
              📅 Schedule Demo
            </button>
          </div>
        </div>
      </section>

      <section className="py-4 border-b border-gray-200 sticky top-16 bg-white z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center gap-2 overflow-x-auto pb-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
                  activeCategory === cat.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-gradient-to-r from-yellow-50 to-orange-50 border-b border-yellow-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 mb-6">
            <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
            <span className="text-sm font-bold text-yellow-700 uppercase tracking-wide">Flagship Feature</span>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="bg-white rounded-2xl p-8 shadow-xl border border-yellow-200">
              <div className="grid grid-cols-2 gap-4">
                {['Build-to-Sell', 'Flip', 'Rental', 'Airbnb'].map((strategy, i) => {
                  const colors = ['bg-green-500', 'bg-blue-500', 'bg-purple-500', 'bg-orange-500'];
                  const rois = ['24%', '28%', '42%', '35%'];
                  return (
                    <div key={i} className={`${colors[i]} text-white rounded-xl p-4 text-center`}>
                      <div className="text-sm opacity-80">{strategy}</div>
                      <div className="text-2xl font-bold">{rois[i]} ROI</div>
                      {strategy === 'Rental' && (
                        <div className="text-xs bg-white/20 rounded px-2 py-1 mt-2">⭐ Best Option</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Strategy Arbitrage Analysis™
              </h2>
              <p className="text-gray-600 mb-6">
                Most investors look at properties one way: "Is this a good flip?" or "Will this rent?"
              </p>
              <p className="text-gray-900 font-medium mb-4">
                JediRe analyzes ALL 4 strategies simultaneously:
              </p>
              <ul className="space-y-2 mb-6">
                {['Build-to-Sell', 'Flip & Renovate', 'Buy-and-Hold Rental', 'Short-Term Rental (Airbnb)'].map((s, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-green-500" />
                    <span className="text-gray-700">{s}</span>
                  </li>
                ))}
              </ul>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-blue-900">Real Example:</span>
                </div>
                <p className="text-gray-700 text-sm mb-2">
                  Property listed as "flip opportunity"
                </p>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-600">Flip ROI: 24%</span>
                  <span className="text-green-600 font-semibold">Rental ROI: 42% ⭐ 18% HIGHER!</span>
                </div>
                <p className="text-blue-700 font-medium mt-2">
                  You just found $42K in extra profit
                </p>
              </div>

              <button className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                See It In Action <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8">
            {filteredFeatures.map((feature, i) => (
              <div key={i} className="bg-white rounded-2xl p-8 border border-gray-200 hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <feature.icon className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{feature.title}</h3>
                    <p className="text-gray-500 text-sm">{feature.description}</p>
                  </div>
                </div>
                <ul className="space-y-2">
                  {feature.bullets.map((bullet, j) => (
                    <li key={j} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                      <span className="text-gray-600 text-sm">{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Meet Our AI Agent Ecosystem
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              12+ autonomous agents working 24/7 to find you the best opportunities
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {agentDetails.map((agent, i) => (
              <div key={i} className="bg-white rounded-xl p-5 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-900">{agent.name}</span>
                  <span className={`text-sm font-medium ${
                    agent.confidence >= 90 ? 'text-green-600' : 'text-blue-600'
                  }`}>
                    {agent.confidence}%
                  </span>
                </div>
                <p className="text-gray-500 text-sm">{agent.description}</p>
                <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${
                      agent.confidence >= 90 ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${agent.confidence}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-8">
            <p className="text-gray-500 text-sm">
              All agents provide: Confidence scores (85-99% typical) • Contributing factors • Real-time updates
            </p>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              How Our Features Work Together
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Globe, title: 'Data Collection', desc: 'AI agents continuously monitor 50+ markets, tracking inventory, prices, and trends in real-time.' },
              { icon: Bot, title: 'AI Analysis', desc: 'Each property is analyzed across all 4 strategies with financial modeling and risk assessment.' },
              { icon: Target, title: 'Opportunity Detection', desc: 'Arbitrage opportunities are flagged instantly, with confidence scores and actionable insights.' },
            ].map((step, i) => (
              <div key={i} className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <step.icon className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-gray-600 text-sm">{step.desc}</p>
                {i < 2 && (
                  <div className="hidden md:block mt-4">
                    <ChevronRight className="w-6 h-6 text-gray-300 mx-auto rotate-90 md:rotate-0" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-br from-blue-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to See These Features in Action?</h2>
          <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
            Start your free 30-day trial and experience AI-powered real estate intelligence.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate('/auth')}
              className="px-8 py-4 bg-white text-blue-600 hover:bg-gray-100 rounded-xl font-semibold text-lg"
            >
              Start Free Trial
            </button>
            <Link
              to="/pricing"
              className="px-8 py-4 bg-white/10 hover:bg-white/20 border border-white/30 rounded-xl font-semibold text-lg"
            >
              View Pricing
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
