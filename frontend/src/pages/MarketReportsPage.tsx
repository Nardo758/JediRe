import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ArrowLeft, FileText, Download, Search, Calendar, MapPin, TrendingUp } from 'lucide-react';

interface Report {
  id: string;
  title: string;
  market: string;
  date: string;
  type: string;
  pages: number;
  featured?: boolean;
}

const reports: Report[] = [
  { id: '1', title: 'Austin Market Analysis Q4 2025', market: 'Austin, TX', date: 'Jan 15, 2026', type: 'Quarterly', pages: 24, featured: true },
  { id: '2', title: 'Texas Multi-Family Outlook 2026', market: 'Texas', date: 'Jan 10, 2026', type: 'Annual', pages: 48, featured: true },
  { id: '3', title: 'Dallas-Fort Worth Investment Guide', market: 'Dallas, TX', date: 'Jan 5, 2026', type: 'Special', pages: 32 },
  { id: '4', title: 'Houston Rental Market Report', market: 'Houston, TX', date: 'Dec 28, 2025', type: 'Quarterly', pages: 18 },
  { id: '5', title: 'San Antonio Emerging Neighborhoods', market: 'San Antonio, TX', date: 'Dec 20, 2025', type: 'Special', pages: 22 },
  { id: '6', title: 'Austin Market Analysis Q3 2025', market: 'Austin, TX', date: 'Oct 15, 2025', type: 'Quarterly', pages: 24 },
];

const markets = ['All Markets', 'Austin, TX', 'Dallas, TX', 'Houston, TX', 'San Antonio, TX', 'Texas'];

export default function MarketReportsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMarket, setSelectedMarket] = useState('All Markets');

  const filteredReports = reports.filter(r => {
    const matchesMarket = selectedMarket === 'All Markets' || r.market === selectedMarket;
    const matchesSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesMarket && matchesSearch;
  });

  const featuredReports = reports.filter(r => r.featured);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Link to="/" className="text-gray-400 hover:text-gray-600 mr-4">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <FileText className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">Market Reports</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Featured Reports</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {featuredReports.map(report => (
              <div key={report.id} className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white">
                <div className="flex items-start justify-between mb-4">
                  <span className="px-2 py-1 bg-white/20 rounded text-xs">{report.type}</span>
                  <TrendingUp className="w-6 h-6 text-white/60" />
                </div>
                <h3 className="text-xl font-bold mb-2">{report.title}</h3>
                <div className="flex items-center gap-4 text-white/80 text-sm mb-4">
                  <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {report.market}</span>
                  <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {report.date}</span>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 bg-white text-blue-600 rounded-lg font-medium hover:bg-gray-100">
                  <Download className="w-4 h-4" /> Download PDF
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={selectedMarket}
            onChange={(e) => setSelectedMarket(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {markets.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">All Reports ({filteredReports.length})</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {filteredReports.map(report => (
              <div key={report.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{report.title}</h4>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span>{report.market}</span>
                      <span>•</span>
                      <span>{report.date}</span>
                      <span>•</span>
                      <span>{report.pages} pages</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    report.type === 'Annual' ? 'bg-purple-100 text-purple-700' :
                    report.type === 'Special' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {report.type}
                  </span>
                  <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                    <Download className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
