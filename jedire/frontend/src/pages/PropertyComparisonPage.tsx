import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ArrowLeft, Plus, X, TrendingUp, DollarSign, Home, MapPin, Check } from 'lucide-react';

interface Property {
  id: string;
  address: string;
  city: string;
  price: number;
  sqft: number;
  beds: number;
  baths: number;
  yearBuilt: number;
  roi: number;
  cashFlow: number;
  capRate: number;
  strategy: string;
  score: number;
  zoning: string;
}

const sampleProperties: Property[] = [
  { id: '1', address: '123 Oak Street', city: 'Austin, TX', price: 425000, sqft: 1850, beds: 3, baths: 2, yearBuilt: 2015, roi: 18.5, cashFlow: 850, capRate: 6.2, strategy: 'Build-to-Sell', score: 92, zoning: 'MF-3' },
  { id: '2', address: '456 Pine Avenue', city: 'Austin, TX', price: 385000, sqft: 1650, beds: 3, baths: 2, yearBuilt: 2008, roi: 15.2, cashFlow: 720, capRate: 5.8, strategy: 'Rental', score: 85, zoning: 'SF-3' },
  { id: '3', address: '789 Cedar Lane', city: 'Austin, TX', price: 510000, sqft: 2200, beds: 4, baths: 3, yearBuilt: 2020, roi: 22.1, cashFlow: 1100, capRate: 7.1, strategy: 'Flip', score: 88, zoning: 'GR' },
  { id: '4', address: '321 Maple Drive', city: 'Austin, TX', price: 295000, sqft: 1400, beds: 2, baths: 2, yearBuilt: 2012, roi: 12.8, cashFlow: 580, capRate: 5.2, strategy: 'Airbnb', score: 78, zoning: 'SF-3' },
];

export default function PropertyComparisonPage() {
  const [selectedIds, setSelectedIds] = useState<string[]>(['1', '2']);
  const selectedProperties = sampleProperties.filter(p => selectedIds.includes(p.id));

  const addProperty = (id: string) => {
    if (selectedIds.length < 4 && !selectedIds.includes(id)) {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const removeProperty = (id: string) => {
    setSelectedIds(selectedIds.filter(i => i !== id));
  };

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  const getBestValue = (key: keyof Property, higher = true) => {
    const values = selectedProperties.map(p => p[key] as number);
    return higher ? Math.max(...values) : Math.min(...values);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link to="/app" className="text-gray-400 hover:text-gray-600">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-2">
                <Building2 className="w-8 h-8 text-blue-600" />
                <span className="text-xl font-bold text-gray-900">Property Comparison</span>
              </div>
            </div>
            <span className="text-sm text-gray-500">{selectedIds.length}/4 properties selected</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {selectedIds.length < 4 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Add property to compare:</h3>
            <div className="flex flex-wrap gap-2">
              {sampleProperties.filter(p => !selectedIds.includes(p.id)).map(p => (
                <button
                  key={p.id}
                  onClick={() => addProperty(p.id)}
                  className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:border-blue-300 text-sm"
                >
                  <Plus className="w-4 h-4 text-blue-600" />
                  {p.address}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full bg-white rounded-xl border border-gray-200">
            <thead>
              <tr>
                <th className="text-left p-4 bg-gray-50 font-medium text-gray-700 w-48">Property</th>
                {selectedProperties.map(p => (
                  <th key={p.id} className="p-4 bg-gray-50 min-w-[200px]">
                    <div className="flex items-start justify-between">
                      <div className="text-left">
                        <div className="font-semibold text-gray-900">{p.address}</div>
                        <div className="text-sm text-gray-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {p.city}
                        </div>
                      </div>
                      <button onClick={() => removeProperty(p.id)} className="text-gray-400 hover:text-red-500">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="p-4 text-gray-600 font-medium">Price</td>
                {selectedProperties.map(p => (
                  <td key={p.id} className={`p-4 text-center font-semibold ${p.price === getBestValue('price', false) ? 'text-green-600' : 'text-gray-900'}`}>
                    {formatCurrency(p.price)}
                    {p.price === getBestValue('price', false) && <Check className="w-4 h-4 inline ml-1" />}
                  </td>
                ))}
              </tr>
              <tr className="bg-gray-50">
                <td className="p-4 text-gray-600 font-medium">JediRe Score</td>
                {selectedProperties.map(p => (
                  <td key={p.id} className={`p-4 text-center font-bold text-lg ${p.score === getBestValue('score') ? 'text-green-600' : 'text-gray-900'}`}>
                    {p.score}
                    {p.score === getBestValue('score') && <Check className="w-4 h-4 inline ml-1" />}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-4 text-gray-600 font-medium">Strategy</td>
                {selectedProperties.map(p => (
                  <td key={p.id} className="p-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      p.strategy === 'Build-to-Sell' ? 'bg-green-100 text-green-700' :
                      p.strategy === 'Flip' ? 'bg-blue-100 text-blue-700' :
                      p.strategy === 'Rental' ? 'bg-purple-100 text-purple-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {p.strategy}
                    </span>
                  </td>
                ))}
              </tr>
              <tr className="bg-gray-50">
                <td className="p-4 text-gray-600 font-medium">ROI</td>
                {selectedProperties.map(p => (
                  <td key={p.id} className={`p-4 text-center font-semibold ${p.roi === getBestValue('roi') ? 'text-green-600' : 'text-gray-900'}`}>
                    {p.roi}%
                    {p.roi === getBestValue('roi') && <Check className="w-4 h-4 inline ml-1" />}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-4 text-gray-600 font-medium">Monthly Cash Flow</td>
                {selectedProperties.map(p => (
                  <td key={p.id} className={`p-4 text-center font-semibold ${p.cashFlow === getBestValue('cashFlow') ? 'text-green-600' : 'text-gray-900'}`}>
                    {formatCurrency(p.cashFlow)}/mo
                    {p.cashFlow === getBestValue('cashFlow') && <Check className="w-4 h-4 inline ml-1" />}
                  </td>
                ))}
              </tr>
              <tr className="bg-gray-50">
                <td className="p-4 text-gray-600 font-medium">Cap Rate</td>
                {selectedProperties.map(p => (
                  <td key={p.id} className={`p-4 text-center ${p.capRate === getBestValue('capRate') ? 'text-green-600 font-semibold' : 'text-gray-900'}`}>
                    {p.capRate}%
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-4 text-gray-600 font-medium">Sq Ft</td>
                {selectedProperties.map(p => (
                  <td key={p.id} className="p-4 text-center text-gray-900">{p.sqft.toLocaleString()}</td>
                ))}
              </tr>
              <tr className="bg-gray-50">
                <td className="p-4 text-gray-600 font-medium">Beds / Baths</td>
                {selectedProperties.map(p => (
                  <td key={p.id} className="p-4 text-center text-gray-900">{p.beds} bd / {p.baths} ba</td>
                ))}
              </tr>
              <tr>
                <td className="p-4 text-gray-600 font-medium">Year Built</td>
                {selectedProperties.map(p => (
                  <td key={p.id} className="p-4 text-center text-gray-900">{p.yearBuilt}</td>
                ))}
              </tr>
              <tr className="bg-gray-50">
                <td className="p-4 text-gray-600 font-medium">Zoning</td>
                {selectedProperties.map(p => (
                  <td key={p.id} className="p-4 text-center">
                    <span className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">{p.zoning}</span>
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-4 text-gray-600 font-medium">Price/Sq Ft</td>
                {selectedProperties.map(p => (
                  <td key={p.id} className="p-4 text-center text-gray-900">${Math.round(p.price / p.sqft)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
