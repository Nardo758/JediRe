import { useState } from 'react';
import { Search, MapPin, Ruler, Loader2, Building2, ParkingCircle, Home } from 'lucide-react';

interface AnalysisResult {
  address: string;
  coordinates: { lat: number; lng: number };
  municipality: string;
  state: string;
  district_code: string;
  district_name: string;
  lot_size_sqft: number;
  max_units: number;
  max_height_ft: number;
  max_footprint_sqft: number;
  max_gfa_sqft: number;
  parking_required: number;
  setbacks: { front: number; side: number; rear: number };
  opportunity_score: number;
  buildable_envelope_geojson: object;
  ai_summary: string;
  permitted_uses: string[];
}

export default function PropertyAnalyzer() {
  const [address, setAddress] = useState('');
  const [lotSize, setLotSize] = useState<number | ''>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  const analyzeProperty = async () => {
    if (!address || !lotSize) {
      setError('Please enter both address and lot size');
      return;
    }

    setIsLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const geocodeResponse = await fetch('/api/v1/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      });
      const geocodeData = await geocodeResponse.json();

      if (!geocodeData.success) {
        setError('Could not find this address. Please try a different address.');
        setIsLoading(false);
        return;
      }

      const analyzeResponse = await fetch('/api/v1/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: geocodeData.data.displayName,
          lat: geocodeData.data.lat,
          lng: geocodeData.data.lng,
          municipality: geocodeData.data.municipality,
          state: geocodeData.data.state,
          lot_size_sqft: Number(lotSize)
        })
      });
      const analyzeData = await analyzeResponse.json();

      if (!analyzeData.success) {
        setError(analyzeData.error || 'Could not analyze this property. Zoning data may not be available for this area.');
        setIsLoading(false);
        return;
      }

      setAnalysis(analyzeData.data);
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error('Analysis error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (num: number) => num.toLocaleString();

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b p-4">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Property Analyzer</h2>
        
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <MapPin className="w-4 h-4 inline mr-1" />
              Property Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St, Austin, TX"
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              onKeyPress={(e) => e.key === 'Enter' && analyzeProperty()}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Ruler className="w-4 h-4 inline mr-1" />
              Lot Size (sq ft)
            </label>
            <input
              type="number"
              value={lotSize}
              onChange={(e) => setLotSize(e.target.value ? Number(e.target.value) : '')}
              placeholder="8000"
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              onKeyPress={(e) => e.key === 'Enter' && analyzeProperty()}
            />
          </div>

          <button
            onClick={analyzeProperty}
            disabled={isLoading || !address || !lotSize}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Analyze Property
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {analysis ? (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-4 shadow-sm border">
              <div className="text-sm text-gray-600 mb-1">Zoning District</div>
              <div className="text-2xl font-bold text-blue-600">{analysis.district_code}</div>
              <div className="text-sm text-gray-700">{analysis.district_name}</div>
              <div className="text-xs text-gray-500 mt-1">{analysis.municipality}, {analysis.state}</div>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl p-4 text-white shadow-lg">
              <div className="text-sm opacity-90 mb-1">Development Score</div>
              <div className="text-4xl font-bold">{analysis.opportunity_score}/100</div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold text-gray-900">Development Potential</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="text-xs text-gray-600">Max Units</div>
                  <div className="text-2xl font-bold text-green-600">{analysis.max_units}</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="text-xs text-gray-600">Max Height</div>
                  <div className="text-xl font-bold text-green-600">{analysis.max_height_ft} ft</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="text-xs text-gray-600">Max Footprint</div>
                  <div className="text-lg font-bold text-blue-600">{formatNumber(analysis.max_footprint_sqft)} sf</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="text-xs text-gray-600">Max GFA</div>
                  <div className="text-lg font-bold text-blue-600">{formatNumber(analysis.max_gfa_sqft)} sf</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border">
              <div className="flex items-center gap-2 mb-3">
                <Ruler className="w-5 h-5 text-yellow-600" />
                <h3 className="font-semibold text-gray-900">Setbacks</h3>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-yellow-50 rounded-lg p-3">
                  <div className="text-xs text-gray-600">Front</div>
                  <div className="text-xl font-bold text-yellow-600">{analysis.setbacks.front}'</div>
                </div>
                <div className="bg-yellow-50 rounded-lg p-3">
                  <div className="text-xs text-gray-600">Side</div>
                  <div className="text-xl font-bold text-yellow-600">{analysis.setbacks.side}'</div>
                </div>
                <div className="bg-yellow-50 rounded-lg p-3">
                  <div className="text-xs text-gray-600">Rear</div>
                  <div className="text-xl font-bold text-yellow-600">{analysis.setbacks.rear}'</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border">
              <div className="flex items-center gap-2 mb-2">
                <ParkingCircle className="w-5 h-5 text-purple-600" />
                <h3 className="font-semibold text-gray-900">Parking Required</h3>
              </div>
              <div className="text-3xl font-bold text-purple-600">
                {analysis.parking_required}
                <span className="text-sm text-gray-600 ml-2">spaces</span>
              </div>
            </div>

            {analysis.permitted_uses && analysis.permitted_uses.length > 0 && (
              <div className="bg-white rounded-xl p-4 shadow-sm border">
                <div className="flex items-center gap-2 mb-3">
                  <Home className="w-5 h-5 text-teal-600" />
                  <h3 className="font-semibold text-gray-900">Permitted Uses</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {analysis.permitted_uses.map((use, i) => (
                    <span key={i} className="bg-teal-50 text-teal-700 px-2 py-1 rounded text-sm">
                      {use.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-gray-100 rounded-xl p-4">
              <h3 className="font-semibold text-gray-900 mb-2">AI Summary</h3>
              <p className="text-sm text-gray-700 leading-relaxed">{analysis.ai_summary}</p>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 mt-8">
            <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Enter an address and lot size to analyze zoning potential</p>
            <p className="text-sm mt-2 text-gray-400">Currently supporting Austin, TX</p>
          </div>
        )}
      </div>
    </div>
  );
}
