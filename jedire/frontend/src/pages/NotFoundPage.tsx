import { Link } from 'react-router-dom';
import { Building2, Home, Search, ArrowLeft, HelpCircle } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Link to="/" className="flex items-center gap-2">
              <Building2 className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">JediRe</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="text-8xl font-bold text-gray-200 mb-4">404</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Page Not Found</h1>
          <p className="text-gray-600 mb-8">
            Oops! The page you're looking for doesn't exist or has been moved.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Link
              to="/"
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
            >
              <Home className="w-5 h-5" /> Go Home
            </Link>
            <button
              onClick={() => window.history.back()}
              className="flex items-center gap-2 px-6 py-3 border border-gray-300 hover:bg-gray-50 rounded-lg font-medium text-gray-700"
            >
              <ArrowLeft className="w-5 h-5" /> Go Back
            </button>
          </div>

          <div className="border-t border-gray-200 pt-8">
            <p className="text-sm text-gray-500 mb-4">Looking for something specific?</p>
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <Link to="/app" className="text-blue-600 hover:text-blue-700 flex items-center gap-1">
                <Search className="w-4 h-4" /> Search Properties
              </Link>
              <Link to="/help" className="text-blue-600 hover:text-blue-700 flex items-center gap-1">
                <HelpCircle className="w-4 h-4" /> Help Center
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
