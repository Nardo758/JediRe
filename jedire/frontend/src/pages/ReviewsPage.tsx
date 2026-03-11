import { Link } from 'react-router-dom';
import { Building2, ArrowLeft, Star, ThumbsUp, ExternalLink, Quote } from 'lucide-react';

const reviews = [
  { source: 'G2', rating: 4.8, count: 245, logo: '🏆' },
  { source: 'Capterra', rating: 4.7, count: 189, logo: '⭐' },
  { source: 'TrustPilot', rating: 4.6, count: 312, logo: '🌟' },
  { source: 'Product Hunt', rating: 4.9, count: 156, logo: '🚀' },
];

const testimonials = [
  { name: 'Mike T.', role: 'Real Estate Investor', source: 'G2', rating: 5, text: 'JediRe has completely transformed how I analyze properties. The AI insights are incredibly accurate.', date: 'Jan 2026' },
  { name: 'Sarah L.', role: 'First-time Flipper', source: 'Capterra', rating: 5, text: 'As a beginner, this tool gave me the confidence to make my first investment. ROI projections were spot on!', date: 'Jan 2026' },
  { name: 'David K.', role: 'Portfolio Manager', source: 'TrustPilot', rating: 5, text: 'Managing 20+ properties is so much easier now. The analytics dashboard saves me hours every week.', date: 'Dec 2025' },
  { name: 'Jennifer M.', role: 'Real Estate Agent', source: 'G2', rating: 4, text: 'Great tool for providing data-driven recommendations to my investor clients. Worth every penny.', date: 'Dec 2025' },
  { name: 'Robert H.', role: 'Developer', source: 'Product Hunt', rating: 5, text: 'The zoning intelligence feature is a game-changer. Identified development potential I would have missed.', date: 'Nov 2025' },
  { name: 'Lisa P.', role: 'Airbnb Host', source: 'TrustPilot', rating: 5, text: 'The short-term rental analysis helped me find the perfect investment property. Cash flow exceeds projections!', date: 'Nov 2025' },
];

export default function ReviewsPage() {
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
              <span className="text-xl font-bold text-gray-900">Reviews & Ratings</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Trusted by Investors Worldwide</h1>
          <p className="text-gray-600">See what our users are saying across review platforms</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {reviews.map((r, i) => (
            <div key={i} className="bg-white rounded-xl p-6 border border-gray-200 text-center">
              <span className="text-4xl mb-3 block">{r.logo}</span>
              <h3 className="font-semibold text-gray-900 mb-2">{r.source}</h3>
              <div className="flex items-center justify-center gap-1 mb-2">
                {[...Array(5)].map((_, j) => (
                  <Star key={j} className={`w-5 h-5 ${j < Math.floor(r.rating) ? 'text-yellow-400 fill-current' : 'text-gray-200'}`} />
                ))}
              </div>
              <div className="text-2xl font-bold text-gray-900">{r.rating}</div>
              <div className="text-sm text-gray-500">{r.count} reviews</div>
            </div>
          ))}
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-6">Recent Reviews</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {testimonials.map((t, i) => (
            <div key={i} className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{t.name}</p>
                    <p className="text-sm text-gray-500">{t.role}</p>
                  </div>
                </div>
                <span className="text-sm text-gray-400">{t.source}</span>
              </div>
              <div className="flex items-center gap-1 mb-3">
                {[...Array(5)].map((_, j) => (
                  <Star key={j} className={`w-4 h-4 ${j < t.rating ? 'text-yellow-400 fill-current' : 'text-gray-200'}`} />
                ))}
              </div>
              <p className="text-gray-600 mb-3">"{t.text}"</p>
              <p className="text-sm text-gray-400">{t.date}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 bg-blue-600 rounded-xl p-8 text-white text-center">
          <h2 className="text-2xl font-bold mb-4">Love JediRe? Leave a Review!</h2>
          <p className="text-white/80 mb-6">Your feedback helps other investors discover our platform</p>
          <div className="flex flex-wrap justify-center gap-4">
            {reviews.map((r, i) => (
              <a key={i} href="#" className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg">
                <span>{r.logo}</span>
                <span>Review on {r.source}</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
