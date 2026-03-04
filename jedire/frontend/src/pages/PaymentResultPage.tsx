import { Link, useSearchParams } from 'react-router-dom';
import { Building2, CheckCircle, XCircle, CreditCard, ArrowRight, RotateCcw } from 'lucide-react';

export default function PaymentResultPage() {
  const [searchParams] = useSearchParams();
  const status = searchParams.get('status') || 'success';
  const plan = searchParams.get('plan') || 'Professional';
  const isSuccess = status === 'success';

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
          {isSuccess ? (
            <>
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-4">Payment Successful!</h1>
              <p className="text-gray-600 mb-6">
                Thank you for subscribing to {plan}. Your account has been upgraded and you now have access to all premium features.
              </p>
              
              <div className="bg-white rounded-xl p-6 border border-gray-200 mb-8">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-gray-600">Plan</span>
                  <span className="font-semibold text-gray-900">{plan}</span>
                </div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-gray-600">Status</span>
                  <span className="text-green-600 font-medium">Active</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Billing</span>
                  <span className="text-gray-900">Monthly</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  to="/app"
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                >
                  Go to Dashboard <ArrowRight className="w-5 h-5" />
                </Link>
                <Link
                  to="/settings"
                  className="flex items-center gap-2 px-6 py-3 border border-gray-300 hover:bg-gray-50 rounded-lg font-medium text-gray-700"
                >
                  <CreditCard className="w-5 h-5" /> Manage Billing
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-10 h-10 text-red-600" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-4">Payment Failed</h1>
              <p className="text-gray-600 mb-6">
                We couldn't process your payment. Please check your payment details and try again.
              </p>
              
              <div className="bg-red-50 rounded-xl p-4 border border-red-100 mb-8">
                <p className="text-red-700 text-sm">
                  Your card was declined. Please try a different payment method or contact your bank.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  to="/pricing"
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                >
                  <RotateCcw className="w-5 h-5" /> Try Again
                </Link>
                <Link
                  to="/contact"
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Contact Support
                </Link>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
