import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Building2, Menu, Search, Flame, ChevronRight, Download, 
  FileSpreadsheet, BookOpen, Video
} from 'lucide-react';

interface Article {
  id: string;
  category: string;
  title: string;
  excerpt: string;
  author: string;
  readTime: string;
  date: string;
  featured?: boolean;
}

interface Resource {
  type: 'template' | 'ebook' | 'webinar';
  title: string;
  subtitle: string;
  action: string;
}

const categories = [
  'All', 'Strategy', 'Market Analysis', 'AI & Technology', 
  'Case Studies', 'How-To Guides', 'Product Updates', 'Industry News'
];

const articles: Article[] = [
  {
    id: '1',
    category: 'Case Studies',
    title: 'How Strategy Arbitrage Found $42K in Hidden Value',
    excerpt: 'Real case study: Property listed as flip opportunity actually worth 31% more as rental. Learn the framework.',
    author: 'Sarah Johnson',
    readTime: '5 min read',
    date: 'Feb 1, 2026',
    featured: true,
  },
  {
    id: '2',
    category: 'Strategy',
    title: 'The 4-Way Analysis: Why Single-Strategy Investing Leaves Money on the Table',
    excerpt: 'Most investors analyze properties one way. Here\'s why you should analyze all 4...',
    author: 'Mike Chen',
    readTime: '8 min read',
    date: 'Jan 28',
  },
  {
    id: '3',
    category: 'Market Analysis',
    title: 'Atlanta Market Update: Interest Rate Impact on Single Family Opportunities',
    excerpt: 'Fed rate decision creates 23 new arbitrage opportunities in metro Atlanta...',
    author: 'Leon Doe',
    readTime: '6 min read',
    date: 'Jan 25',
  },
  {
    id: '4',
    category: 'How-To Guides',
    title: 'How to Use AI Agents to Analyze 100+ Properties in Under an Hour',
    excerpt: 'Step-by-step guide to setting filters and letting JediRe\'s agents do the work...',
    author: 'Product Team',
    readTime: '10 min read',
    date: 'Jan 22',
  },
  {
    id: '5',
    category: 'AI & Technology',
    title: 'Inside the AI: How Our 12 Agents Work Together',
    excerpt: 'A behind-the-scenes look at how Supply, Demand, and Strategy agents collaborate...',
    author: 'Sarah Johnson',
    readTime: '7 min read',
    date: 'Jan 18',
  },
  {
    id: '6',
    category: 'Industry News',
    title: '2026 Real Estate Outlook: Where AI Sees the Best Opportunities',
    excerpt: 'Our AI analyzed 500,000 properties to predict the hottest markets of 2026...',
    author: 'Leon Doe',
    readTime: '12 min read',
    date: 'Jan 15',
  },
];

const popularResources = [
  'The Complete Guide to Strategy Arbitrage Investing',
  '10 Hidden Opportunities AI Found That Humans Missed',
  'ROI Calculator: Flip vs Rental vs Build vs Airbnb',
  'Market Timing: Using AI to Predict Interest Rate Impact',
  'Case Study: $2.1M Portfolio Built Using JediRe',
];

const downloadableResources: Resource[] = [
  { type: 'template', title: '4-Strategy ROI Comparison', subtitle: 'Spreadsheet', action: 'Download' },
  { type: 'ebook', title: 'AI-Powered Investing: The Complete Guide (2026)', subtitle: '', action: 'Download' },
  { type: 'webinar', title: 'Finding Your First Arbitrage Opportunity', subtitle: '', action: 'Watch On-Demand' },
];

export default function BlogPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const featuredArticle = articles.find(a => a.featured);
  const latestArticles = articles.filter(a => !a.featured);
  
  const filteredArticles = latestArticles.filter(article => {
    const matchesCategory = selectedCategory === 'All' || article.category === selectedCategory;
    const matchesSearch = article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         article.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && (searchQuery === '' || matchesSearch);
  });

  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'template': return <FileSpreadsheet className="w-8 h-8 text-blue-600" />;
      case 'ebook': return <BookOpen className="w-8 h-8 text-green-600" />;
      case 'webinar': return <Video className="w-8 h-8 text-purple-600" />;
      default: return <Download className="w-8 h-8 text-gray-600" />;
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Strategy': 'bg-blue-100 text-blue-700',
      'Market Analysis': 'bg-green-100 text-green-700',
      'AI & Technology': 'bg-purple-100 text-purple-700',
      'Case Studies': 'bg-orange-100 text-orange-700',
      'How-To Guides': 'bg-teal-100 text-teal-700',
      'Product Updates': 'bg-pink-100 text-pink-700',
      'Industry News': 'bg-yellow-100 text-yellow-700',
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
              <Link to="/blog" className="text-blue-600 text-sm font-medium">Blog</Link>
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
              <Link to="/blog" className="block text-blue-600 font-medium">Blog</Link>
              <hr className="border-gray-200" />
              <button onClick={() => navigate('/auth')} className="block w-full text-left text-gray-600 font-medium">Login</button>
              <button onClick={() => navigate('/auth')} className="block w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-center">Sign Up</button>
            </div>
          </div>
        )}
      </header>

      <section className="pt-28 pb-12 bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">JediRe Insights</h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Data-driven real estate investing strategies, market analysis, and AI-powered insights
          </p>
          
          <div className="max-w-xl mx-auto">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search articles..."
                aria-label="Search articles"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-24 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                Search
              </button>
            </div>
          </div>
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

      {featuredArticle && selectedCategory === 'All' && searchQuery === '' && (
        <section className="py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-2xl p-6 sm:p-8 border border-orange-200">
              <div className="flex flex-col md:flex-row gap-8">
                <div className="md:w-1/3">
                  <div className="aspect-video bg-gradient-to-br from-orange-400 to-yellow-500 rounded-xl flex items-center justify-center">
                    <span className="text-white text-6xl">📈</span>
                  </div>
                </div>
                <div className="md:w-2/3">
                  <div className="flex items-center gap-2 mb-3">
                    <Flame className="w-5 h-5 text-orange-500" />
                    <span className="text-sm font-bold text-orange-600 uppercase tracking-wide">Featured</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
                    {featuredArticle.title}
                  </h2>
                  <p className="text-gray-600 mb-4">{featuredArticle.excerpt}</p>
                  <p className="text-sm text-gray-500 mb-4">
                    By {featuredArticle.author} • {featuredArticle.readTime} • {featuredArticle.date}
                  </p>
                  <button className="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1">
                    Read Full Article <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            {selectedCategory === 'All' ? 'Latest Articles' : selectedCategory}
          </h2>
          
          <div className="space-y-6">
            {filteredArticles.map((article) => (
              <div key={article.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
                <div className="flex flex-col sm:flex-row">
                  <div className="sm:w-48 h-32 sm:h-auto bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center flex-shrink-0">
                    <span className="text-4xl">📊</span>
                  </div>
                  <div className="p-6 flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getCategoryColor(article.category)}`}>
                        {article.category.toUpperCase()}
                      </span>
                      <span className="text-sm text-gray-400">{article.date}</span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{article.title}</h3>
                    <p className="text-gray-600 text-sm mb-3">{article.excerpt}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">By {article.author} • {article.readTime}</span>
                      <button className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1">
                        Read More <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredArticles.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No articles found for this category.
            </div>
          )}

          {filteredArticles.length > 0 && (
            <div className="text-center mt-8">
              <button className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium">
                Load More Articles
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Most Popular</h2>
          
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {popularResources.map((resource, i) => (
              <div key={i} className="p-4 flex items-center gap-4 hover:bg-gray-50 cursor-pointer">
                <span className="text-2xl font-bold text-gray-300">{i + 1}</span>
                <span className="text-gray-900 font-medium">{resource}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Free Resources & Templates</h2>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {downloadableResources.map((resource, i) => (
              <div key={i} className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    {getResourceIcon(resource.type)}
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                      {resource.type}
                    </span>
                    <h3 className="font-semibold text-gray-900 mt-1">{resource.title}</h3>
                    {resource.subtitle && (
                      <p className="text-sm text-gray-500">{resource.subtitle}</p>
                    )}
                  </div>
                </div>
                <button className="w-full mt-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2">
                  {resource.action} <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-gradient-to-br from-blue-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Stay Ahead of the Market</h2>
          <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
            Get weekly insights, market updates, and exclusive strategies delivered to your inbox.
          </p>
          <div className="max-w-md mx-auto flex gap-3">
            <input
              type="email"
              placeholder="Enter your email"
              aria-label="Email for newsletter subscription"
              className="flex-1 px-4 py-3 rounded-lg text-gray-900 placeholder-gray-500"
            />
            <button className="px-6 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-gray-100">
              Subscribe
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
                <li><Link to="/features" className="hover:text-white">Features</Link></li>
                <li><Link to="/pricing" className="hover:text-white">Pricing</Link></li>
                <li><a href="#" className="hover:text-white">API</a></li>
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
