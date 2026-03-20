import { Link } from 'react-router-dom';
import { Building2, ArrowLeft, Quote, Star, TrendingUp, DollarSign, MapPin, ChevronRight } from 'lucide-react';

const stories = [
  { id: '1', name: 'Michael Chen', role: 'Real Estate Investor', location: 'Austin, TX', image: '', quote: 'JediRe helped me identify a zoning opportunity that turned a $350k property into a $1.2M development.', profit: '$850,000', roi: '243%', timeframe: '18 months', strategy: 'Build-to-Sell', featured: true },
  { id: '2', name: 'Sarah Williams', role: 'First-time Flipper', location: 'Dallas, TX', image: '', quote: 'As a complete beginner, the AI insights gave me confidence to make my first flip. Made $45k profit!', profit: '$45,000', roi: '28%', timeframe: '4 months', strategy: 'Flip' },
  { id: '3', name: 'David Park', role: 'Portfolio Investor', location: 'Houston, TX', image: '', quote: 'The multi-agent analysis revealed Airbnb potential I would have missed. My cash flow tripled.', profit: '$2,400/mo', roi: '18%', timeframe: 'Ongoing', strategy: 'Airbnb' },
  { id: '4', name: 'Jennifer Martinez', role: 'Real Estate Agent', location: 'San Antonio, TX', image: '', quote: 'I use JediRe to provide data-driven recommendations to my investor clients. Closed 12 more deals this year.', profit: '$180,000', roi: '400%', timeframe: '12 months', strategy: 'Various' },
];

export default function SuccessStoriesPage() {
  const featured = stories.find(s => s.featured);
  const others = stories.filter(s => !s.featured);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Link to="/" className="text-gray-400 hover:text-gray-600 mr-4">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Star className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">Success Stories</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {featured && (
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-8 text-white mb-8">
            <div className="flex flex-col md:flex-row gap-8">
              <div className="flex-1">
                <Quote className="w-10 h-10 text-white/40 mb-4" />
                <p className="text-xl font-medium mb-6">"{featured.quote}"</p>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center text-2xl font-bold">
                    {featured.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold">{featured.name}</p>
                    <p className="text-white/70">{featured.role} • {featured.location}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-2xl font-bold">{featured.profit}</div>
                    <div className="text-white/60 text-sm">Profit</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{featured.roi}</div>
                    <div className="text-white/60 text-sm">ROI</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{featured.timeframe}</div>
                    <div className="text-white/60 text-sm">Timeline</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {others.map(story => (
            <div key={story.id} className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                  {story.name.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{story.name}</p>
                  <p className="text-sm text-gray-500">{story.role}</p>
                </div>
              </div>
              <p className="text-gray-600 mb-4 text-sm italic">"{story.quote}"</p>
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                <MapPin className="w-4 h-4" /> {story.location}
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                <div>
                  <div className="flex items-center gap-1 text-green-600 font-semibold">
                    <DollarSign className="w-4 h-4" /> {story.profit}
                  </div>
                  <div className="text-xs text-gray-500">Profit</div>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-blue-600 font-semibold">
                    <TrendingUp className="w-4 h-4" /> {story.roi}
                  </div>
                  <div className="text-xs text-gray-500">ROI</div>
                </div>
              </div>
              <div className="mt-4">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  story.strategy === 'Flip' ? 'bg-blue-100 text-blue-700' :
                  story.strategy === 'Airbnb' ? 'bg-orange-100 text-orange-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {story.strategy}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Ready to Write Your Success Story?</h3>
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
          >
            Get Started Free <ChevronRight className="w-5 h-5" />
          </Link>
        </div>
      </main>
    </div>
  );
}
