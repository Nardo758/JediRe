import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Building2, Menu, Linkedin, ExternalLink, ChevronRight
} from 'lucide-react';

interface TeamMember {
  name: string;
  role: string;
  experience: string;
  linkedin: string;
}

interface Value {
  icon: string;
  title: string;
  description: string;
}

interface Stat {
  value: string;
  label: string;
}

interface PressItem {
  source: string;
  quote: string;
}

const teamMembers: TeamMember[] = [
  { name: 'Leon Doe', role: 'CEO & Founder', experience: '20+ years RE investing', linkedin: '#' },
  { name: 'Sarah Johnson', role: 'CTO', experience: 'Ex-Google ML Engineer', linkedin: '#' },
  { name: 'Mike Chen', role: 'VP Product', experience: 'Ex-Zillow PM, 15 years RE tech', linkedin: '#' },
  { name: 'Emily Rodriguez', role: 'VP Engineering', experience: 'Ex-Redfin, Stanford CS', linkedin: '#' },
  { name: 'David Park', role: 'Head of Data Science', experience: 'Ex-Meta AI Research', linkedin: '#' },
  { name: 'Jessica Williams', role: 'VP Sales', experience: '12 years PropTech sales', linkedin: '#' },
];

const values: Value[] = [
  { icon: '🎯', title: 'Data Over Gut Feelings', description: 'We believe investment decisions should be driven by data, not intuition.' },
  { icon: '🤝', title: 'Transparency', description: 'Our AI shows its work. See confidence scores, contributing factors, and data sources for every analysis.' },
  { icon: '⚡', title: 'Speed Matters', description: 'Time is money. We turn 2-hour analysis into 2-minute insights.' },
  { icon: '👥', title: 'Human + AI', description: 'AI provides insights, professionals validate, you decide.' },
  { icon: '📈', title: 'Continuous Improvement', description: 'Our agents learn from every property and user interaction.' },
];

const stats: Stat[] = [
  { value: '5,000+', label: 'Active Users' },
  { value: '$2.4B+', label: 'Deal Value' },
  { value: '50+', label: 'Markets Covered' },
  { value: '95%', label: 'AI Accuracy' },
  { value: '23', label: 'Props Per User' },
  { value: '18%', label: 'Avg ROI Gain' },
  { value: '99.8%', label: 'Uptime' },
  { value: '4.9/5', label: 'User Rating' },
];

const investors = ['Andreessen Horowitz', 'Sequoia Capital', 'Khosla Ventures'];
const partners = ['NAR', 'CCIM', 'Urban Land Institute', 'Realtor.com'];

const pressItems: PressItem[] = [
  { source: 'TechCrunch', quote: 'JediRe is revolutionizing real estate investing with AI' },
  { source: 'Forbes', quote: 'The platform that found $80M in missed opportunities' },
  { source: 'WSJ', quote: 'AI-powered strategy arbitrage changes the game' },
];

export default function AboutPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
              <Link to="/about" className="text-blue-600 text-sm font-medium">About</Link>
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
              <Link to="/features" className="block text-gray-600 hover:text-gray-900 font-medium">Features</Link>
              <Link to="/pricing" className="block text-gray-600 hover:text-gray-900 font-medium">Pricing</Link>
              <Link to="/about" className="block text-blue-600 font-medium">About</Link>
              <a href="#" className="block text-gray-600 hover:text-gray-900 font-medium">Blog</a>
              <hr className="border-gray-200" />
              <button onClick={() => navigate('/auth')} className="block w-full text-left text-gray-600 font-medium">Login</button>
              <button onClick={() => navigate('/auth')} className="block w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-center">Sign Up</button>
            </div>
          </div>
        )}
      </header>

      <section className="pt-28 pb-16 bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
            We're on a Mission to Democratize{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              Real Estate Intelligence
            </span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Making professional-grade market analysis accessible to every investor, not just institutions.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Our Story</h2>
          <div className="prose prose-lg text-gray-600">
            <p className="mb-4">
              JediRe was born from frustration. Our founder, an active real estate investor, spent countless 
              hours analyzing properties only to discover after purchase that a different strategy would 
              have yielded 30% higher returns.
            </p>
            <p className="mb-4">
              That <span className="font-semibold text-gray-900">$80,000 mistake</span> became the catalyst 
              for building something better: a platform that analyzes ALL investment strategies simultaneously, 
              powered by AI agents that never sleep.
            </p>
            <p>
              Today, we help <span className="font-semibold text-gray-900">5,000+ investors</span> avoid 
              the same mistake and find opportunities worth <span className="font-semibold text-gray-900">$2.4B+</span> that 
              would have otherwise been missed.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Meet the Team</h2>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {teamMembers.map((member, i) => (
              <div key={i} className="bg-white rounded-xl p-6 border border-gray-200 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">
                    {member.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">{member.name}</h3>
                <p className="text-blue-600 font-medium text-sm mb-2">{member.role}</p>
                <p className="text-gray-500 text-sm mb-4">{member.experience}</p>
                <a href={member.linkedin} className="inline-flex items-center gap-1 text-gray-400 hover:text-blue-600 text-sm">
                  <Linkedin className="w-4 h-4" /> LinkedIn
                </a>
              </div>
            ))}
          </div>

          <div className="text-center mt-8">
            <button className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 mx-auto">
              View Full Team <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Our Values</h2>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {values.map((value, i) => (
              <div key={i} className="bg-white rounded-xl p-6 border border-gray-200">
                <span className="text-3xl mb-4 block">{value.icon}</span>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{value.title}</h3>
                <p className="text-gray-600 text-sm">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold mb-8 text-center">By the Numbers</h2>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {stats.map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl sm:text-4xl font-bold mb-1">{stat.value}</div>
                <div className="text-blue-100 text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Backed By</h2>
              <div className="flex flex-wrap gap-4">
                {investors.map((investor, i) => (
                  <div key={i} className="bg-gray-100 px-6 py-3 rounded-lg text-gray-700 font-medium">
                    {investor}
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Partners</h2>
              <div className="flex flex-wrap gap-4">
                {partners.map((partner, i) => (
                  <div key={i} className="bg-gray-100 px-6 py-3 rounded-lg text-gray-700 font-medium">
                    {partner}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">As Featured In</h2>
          
          <div className="space-y-4">
            {pressItems.map((item, i) => (
              <div key={i} className="bg-white rounded-xl p-6 border border-gray-200 flex items-center gap-6">
                <div className="text-xl font-bold text-gray-400 w-32 flex-shrink-0">{item.source}</div>
                <p className="text-gray-700 italic">"{item.quote}"</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-8">
            <button className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 mx-auto">
              Read All Press Coverage <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Join Our Mission</h2>
          <p className="text-gray-600 text-lg mb-8">
            We're hiring world-class engineers, data scientists, and product managers to build 
            the future of real estate investing.
          </p>
          <button className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-lg inline-flex items-center gap-2">
            View Open Positions <ExternalLink className="w-5 h-5" />
          </button>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-br from-blue-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to Join 5,000+ Smart Investors?</h2>
          <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
            Start finding hidden opportunities that others miss.
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
                <li><Link to="/about" className="hover:text-white">About</Link></li>
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
