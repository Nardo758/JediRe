import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ArrowLeft, MessageSquare, ThumbsUp, Eye, Clock, Search, Plus, User, ChevronRight, TrendingUp, HelpCircle, Lightbulb } from 'lucide-react';

interface Post {
  id: string;
  title: string;
  author: string;
  category: string;
  replies: number;
  views: number;
  likes: number;
  lastActivity: string;
  pinned?: boolean;
}

const posts: Post[] = [
  { id: '1', title: 'Welcome to the JediRe Community!', author: 'JediRe Team', category: 'Announcements', replies: 45, views: 1200, likes: 89, lastActivity: '2 hours ago', pinned: true },
  { id: '2', title: 'How to interpret the Strategy Arbitrage panel?', author: 'InvestorMike', category: 'Help', replies: 12, views: 234, likes: 18, lastActivity: '30 min ago' },
  { id: '3', title: 'Austin market Q1 2026 predictions', author: 'TexasFlips', category: 'Market Discussion', replies: 28, views: 456, likes: 34, lastActivity: '1 hour ago' },
  { id: '4', title: 'Best practices for Airbnb analysis', author: 'ShortTermPro', category: 'Tips & Tricks', replies: 15, views: 312, likes: 22, lastActivity: '3 hours ago' },
  { id: '5', title: 'Feature request: Export to Excel', author: 'DataDriven', category: 'Feature Requests', replies: 8, views: 156, likes: 45, lastActivity: '5 hours ago' },
  { id: '6', title: 'My first flip using JediRe - Success Story!', author: 'NewbieFlipper', category: 'Success Stories', replies: 32, views: 567, likes: 78, lastActivity: '1 day ago' },
];

const categories = ['All', 'Announcements', 'Help', 'Market Discussion', 'Tips & Tricks', 'Feature Requests', 'Success Stories'];

export default function CommunityPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const filteredPosts = posts.filter(p => {
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getCategoryIcon = (cat: string) => {
    const icons: Record<string, React.ReactNode> = {
      'Help': <HelpCircle className="w-4 h-4" />,
      'Market Discussion': <TrendingUp className="w-4 h-4" />,
      'Tips & Tricks': <Lightbulb className="w-4 h-4" />,
    };
    return icons[cat] || <MessageSquare className="w-4 h-4" />;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link to="/" className="text-gray-400 hover:text-gray-600">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-2">
                <MessageSquare className="w-8 h-8 text-blue-600" />
                <span className="text-xl font-bold text-gray-900">Community Forum</span>
              </div>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
              <Plus className="w-4 h-4" /> New Post
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search discussions..."
              aria-label="Search discussions"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                selectedCategory === cat ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {filteredPosts.map((post, i) => (
            <div key={post.id} className={`px-6 py-4 flex items-center gap-4 hover:bg-gray-50 cursor-pointer ${i !== filteredPosts.length - 1 ? 'border-b border-gray-200' : ''} ${post.pinned ? 'bg-blue-50' : ''}`}>
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500">
                <User className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {post.pinned && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">Pinned</span>}
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    post.category === 'Announcements' ? 'bg-purple-100 text-purple-700' :
                    post.category === 'Help' ? 'bg-yellow-100 text-yellow-700' :
                    post.category === 'Success Stories' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {post.category}
                  </span>
                </div>
                <h3 className="font-medium text-gray-900 truncate">{post.title}</h3>
                <p className="text-sm text-gray-500">by {post.author} • {post.lastActivity}</p>
              </div>
              <div className="hidden sm:flex items-center gap-6 text-sm text-gray-500">
                <span className="flex items-center gap-1"><MessageSquare className="w-4 h-4" /> {post.replies}</span>
                <span className="flex items-center gap-1"><Eye className="w-4 h-4" /> {post.views}</span>
                <span className="flex items-center gap-1"><ThumbsUp className="w-4 h-4" /> {post.likes}</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>
          ))}
        </div>

        {filteredPosts.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No discussions found matching your search.
          </div>
        )}
      </main>
    </div>
  );
}
