import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ArrowLeft, Users, Search, MapPin, Star, Phone, Mail, ExternalLink } from 'lucide-react';

interface Partner {
  id: string;
  name: string;
  type: string;
  location: string;
  rating: number;
  reviews: number;
  specialties: string[];
  verified: boolean;
}

const partners: Partner[] = [
  { id: '1', name: 'Austin Capital Lending', type: 'Lender', location: 'Austin, TX', rating: 4.9, reviews: 127, specialties: ['Investment Loans', 'DSCR', 'Fix & Flip'], verified: true },
  { id: '2', name: 'Smith & Associates Realty', type: 'Real Estate Agent', location: 'Austin, TX', rating: 4.8, reviews: 89, specialties: ['Investment Properties', 'Multi-Family', 'Commercial'], verified: true },
  { id: '3', name: 'ProBuild Contractors', type: 'Contractor', location: 'Austin, TX', rating: 4.7, reviews: 64, specialties: ['Renovations', 'New Construction', 'ADU'], verified: true },
  { id: '4', name: 'Texas Title Company', type: 'Title Company', location: 'Austin, TX', rating: 4.8, reviews: 156, specialties: ['Closings', 'Title Insurance', '1031 Exchange'], verified: true },
  { id: '5', name: 'Lone Star Property Management', type: 'Property Manager', location: 'Austin, TX', rating: 4.6, reviews: 45, specialties: ['Single Family', 'Multi-Family', 'Airbnb'], verified: false },
  { id: '6', name: 'Investment CPA Group', type: 'CPA/Tax', location: 'Dallas, TX', rating: 4.9, reviews: 78, specialties: ['Real Estate Tax', 'Entity Setup', 'Cost Seg'], verified: true },
];

const types = ['All', 'Lender', 'Real Estate Agent', 'Contractor', 'Title Company', 'Property Manager', 'CPA/Tax'];

export default function PartnerDirectoryPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('All');

  const filteredPartners = partners.filter(p => {
    const matchesType = selectedType === 'All' || p.type === selectedType;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Link to="/" className="text-gray-400 hover:text-gray-600 mr-4">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Users className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">Partner Directory</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-blue-600 rounded-xl p-6 text-white mb-8">
          <h2 className="text-xl font-bold mb-2">Find Trusted Partners</h2>
          <p className="text-white/80">
            Connect with lenders, agents, contractors, and other professionals vetted by the JediRe community.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              id="partner-search"
              name="partnerSearch"
              type="text"
              placeholder="Search partners..."
              aria-label="Search partners"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            id="partner-type-filter"
            name="partnerTypeFilter"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            aria-label="Filter by partner type"
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {types.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {filteredPartners.map(partner => (
            <div key={partner.id} className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{partner.name}</h3>
                    {partner.verified && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">Verified</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{partner.type}</p>
                </div>
                <div className="flex items-center gap-1 text-yellow-500">
                  <Star className="w-4 h-4 fill-current" />
                  <span className="font-medium text-gray-900">{partner.rating}</span>
                  <span className="text-gray-400 text-sm">({partner.reviews})</span>
                </div>
              </div>

              <div className="flex items-center gap-1 text-sm text-gray-500 mb-3">
                <MapPin className="w-4 h-4" /> {partner.location}
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {partner.specialties.map((s, i) => (
                  <span key={i} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">{s}</span>
                ))}
              </div>

              <div className="flex gap-2 pt-4 border-t border-gray-100">
                <button className="flex-1 flex items-center justify-center gap-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm">
                  <Phone className="w-4 h-4" /> Call
                </button>
                <button className="flex-1 flex items-center justify-center gap-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm">
                  <Mail className="w-4 h-4" /> Email
                </button>
                <button className="flex-1 flex items-center justify-center gap-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">
                  <ExternalLink className="w-4 h-4" /> View
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredPartners.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No partners found matching your search.
          </div>
        )}
      </main>
    </div>
  );
}
