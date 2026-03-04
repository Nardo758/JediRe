import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, Search, ChevronRight, ChevronDown, Play, 
  Rocket, BarChart3, CreditCard, Wrench, Users, Smartphone,
  MessageCircle, Mail, Phone, Flame, X
} from 'lucide-react';

interface QuickLink {
  icon: React.ReactNode;
  title: string;
  items: string[];
}

interface Article {
  title: string;
  duration: string;
  hot?: boolean;
}

interface Video {
  title: string;
  duration: string;
}

interface FAQSection {
  category: string;
  questions: string[];
}

const quickLinks: QuickLink[] = [
  { icon: <Rocket className="w-6 h-6 text-blue-600" />, title: 'Getting Started', items: ['Quick start', 'First analysis', 'Video tours'] },
  { icon: <BarChart3 className="w-6 h-6 text-green-600" />, title: 'Features & Modules', items: ['Strategy arbitrage', 'AI agents', 'Bubble map'] },
  { icon: <CreditCard className="w-6 h-6 text-purple-600" />, title: 'Billing & Account', items: ['Plans', 'Payments', 'Cancellation'] },
  { icon: <Wrench className="w-6 h-6 text-orange-600" />, title: 'Troubleshoot', items: ['Login issues', 'Data accuracy', 'Performance'] },
  { icon: <Users className="w-6 h-6 text-teal-600" />, title: 'Collaboration', items: ['Team setup', 'Sharing', 'Comments'] },
  { icon: <Smartphone className="w-6 h-6 text-pink-600" />, title: 'Mobile App', items: ['iOS app', 'Android app', 'Sync issues'] },
];

const popularArticles: Article[] = [
  { title: 'How to Analyze Your First Property', duration: '5 min', hot: true },
  { title: 'Understanding Strategy Arbitrage Scores', duration: '3 min', hot: true },
  { title: 'Setting Up Filters to Find Your Perfect Properties', duration: '4 min', hot: true },
  { title: 'How to Export and Share Property Analysis', duration: '2 min' },
  { title: 'Working with AI Agents: Complete Guide', duration: '8 min' },
  { title: 'Mobile App: Complete Guide', duration: '6 min' },
  { title: 'Team Collaboration Best Practices', duration: '5 min' },
  { title: 'Understanding Confidence Scores', duration: '3 min' },
  { title: 'How to Save and Track Properties', duration: '2 min' },
  { title: 'Integrations: Connecting Your Tools', duration: '7 min' },
];

const videos: Video[] = [
  { title: 'Platform Overview', duration: '5:23' },
  { title: 'Strategy Arbitrage', duration: '8:17' },
  { title: 'Working with Teams', duration: '6:45' },
  { title: 'Advanced Features', duration: '12:30' },
];

const faqSections: FAQSection[] = [
  {
    category: 'Getting Started',
    questions: [
      'How do I sign up for JediRe?',
      'Do I need a credit card for the free trial?',
      'How long is the free trial?',
      'Can I cancel anytime?',
    ],
  },
  {
    category: 'Using JediRe',
    questions: [
      'How accurate are the AI agent predictions?',
      'How often is data updated?',
      'Can I analyze properties in multiple markets?',
      'How do I save properties to my portfolio?',
    ],
  },
  {
    category: 'Billing & Subscriptions',
    questions: [
      'What payment methods do you accept?',
      'Can I change my plan later?',
      'Do you offer refunds?',
      'How do I add or remove modules?',
    ],
  },
];

export default function HelpCenterPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <Building2 className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">JediRe Help Center</span>
            </Link>

            <div className="flex items-center gap-4">
              <Link
                to="/contact"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
              >
                Contact Support
              </Link>
              <Link to="/" className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </Link>
            </div>
          </div>
        </div>
      </header>

      <section className="py-12 bg-gradient-to-br from-blue-600 to-purple-600 text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold mb-6">How can we help you?</h1>
          
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              id="help-search"
              name="helpSearch"
              aria-label="Search for answers"
              placeholder='Search for answers...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-24 py-4 rounded-xl text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-300"
            />
            <button className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              Search
            </button>
          </div>
          <p className="mt-3 text-blue-100 text-sm">
            Try "How do I analyze a property" or "Export report"
          </p>
        </div>
      </section>

      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {quickLinks.map((link, i) => (
              <div key={i} className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer">
                <div className="flex items-center gap-3 mb-4">
                  {link.icon}
                  <h3 className="font-semibold text-gray-900">{link.title}</h3>
                </div>
                <ul className="space-y-2 mb-4">
                  {link.items.map((item, j) => (
                    <li key={j} className="text-gray-600 text-sm flex items-center gap-2">
                      <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                      {item}
                    </li>
                  ))}
                </ul>
                <button className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1">
                  View All <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <span className="text-2xl">📚</span> Most Helpful Articles
          </h2>
          
          <div className="space-y-2">
            {popularArticles.map((article, i) => (
              <div key={i} className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 font-medium w-6">{i + 1}.</span>
                  {article.hot && <Flame className="w-4 h-4 text-orange-500" />}
                  <span className="text-gray-900">{article.title}</span>
                </div>
                <span className="text-gray-400 text-sm">{article.duration}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <span className="text-2xl">🎥</span> Video Library
          </h2>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {videos.map((video, i) => (
              <div key={i} className="bg-white rounded-xl overflow-hidden border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer group">
                <div className="aspect-video bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center relative">
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center group-hover:bg-white/30 transition-colors">
                    <Play className="w-8 h-8 text-white fill-white" />
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900">{video.title}</h3>
                  <p className="text-gray-500 text-sm">{video.duration}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 text-center">
            <button className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 mx-auto">
              View All Videos <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      <section className="py-12 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <span className="text-2xl">❓</span> Frequently Asked Questions
          </h2>
          
          <div className="space-y-6">
            {faqSections.map((section, i) => (
              <div key={i}>
                <h3 className="font-semibold text-gray-900 mb-3">{section.category}</h3>
                <div className="space-y-2">
                  {section.questions.map((question, j) => (
                    <div key={j} className="border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setExpandedFaq(expandedFaq === `${i}-${j}` ? null : `${i}-${j}`)}
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50"
                      >
                        <span className="text-gray-700">{question}</span>
                        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${expandedFaq === `${i}-${j}` ? 'rotate-180' : ''}`} />
                      </button>
                      {expandedFaq === `${i}-${j}` && (
                        <div className="px-4 pb-4 text-gray-600 text-sm">
                          This is the answer to "{question}". Contact our support team for more detailed information.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 text-center">
            <button className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 mx-auto">
              View All FAQs <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Can't Find What You're Looking For?</h2>
          <p className="text-gray-600 text-center mb-8">Our support team is here to help</p>
          
          <div className="grid sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <div className="bg-white rounded-xl p-6 border border-gray-200 text-center hover:shadow-lg transition-shadow">
              <MessageCircle className="w-10 h-10 text-blue-600 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-1">Live Chat</h3>
              <p className="text-gray-500 text-sm mb-4">Response: 2 min</p>
              <button className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
                Start Chat
              </button>
            </div>
            
            <div className="bg-white rounded-xl p-6 border border-gray-200 text-center hover:shadow-lg transition-shadow">
              <Mail className="w-10 h-10 text-green-600 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-1">Email Support</h3>
              <p className="text-gray-500 text-sm mb-4">Response: 4 hrs</p>
              <button 
                onClick={() => window.location.href = 'mailto:support@jedire.com'}
                className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium"
              >
                Send Email
              </button>
            </div>
            
            <div className="bg-white rounded-xl p-6 border border-gray-200 text-center hover:shadow-lg transition-shadow">
              <Phone className="w-10 h-10 text-purple-600 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-1">Call Us</h3>
              <p className="text-gray-500 text-sm mb-4">Mon-Fri 9-5 ET</p>
              <button 
                onClick={() => window.location.href = 'tel:1-800-533-4731'}
                className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium"
              >
                1-800-JEDIRE
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer className="py-8 bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-6 h-6 text-blue-500" />
              <span className="text-lg font-bold text-white">JediRe</span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <Link to="/" className="hover:text-white">Home</Link>
              <Link to="/features" className="hover:text-white">Features</Link>
              <Link to="/pricing" className="hover:text-white">Pricing</Link>
              <Link to="/contact" className="hover:text-white">Contact</Link>
            </div>
            <p className="text-sm">© 2026 JediRe. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
