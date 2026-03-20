import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ArrowLeft, CreditCard, Plus, Trash2, Download, Check, AlertCircle } from 'lucide-react';

interface PaymentMethod {
  id: string;
  type: 'visa' | 'mastercard' | 'amex';
  last4: string;
  expiry: string;
  isDefault: boolean;
}

interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed';
  description: string;
}

const paymentMethods: PaymentMethod[] = [
  { id: '1', type: 'visa', last4: '4242', expiry: '12/26', isDefault: true },
  { id: '2', type: 'mastercard', last4: '8888', expiry: '03/25', isDefault: false },
];

const invoices: Invoice[] = [
  { id: 'INV-2026-001', date: 'Feb 1, 2026', amount: 197, status: 'paid', description: 'Flipper Bundle - Monthly' },
  { id: 'INV-2026-000', date: 'Jan 1, 2026', amount: 197, status: 'paid', description: 'Flipper Bundle - Monthly' },
  { id: 'INV-2025-012', date: 'Dec 1, 2025', amount: 197, status: 'paid', description: 'Flipper Bundle - Monthly' },
  { id: 'INV-2025-011', date: 'Nov 1, 2025', amount: 97, status: 'paid', description: 'Starter - Monthly' },
];

export default function BillingPage() {
  const [methods] = useState<PaymentMethod[]>(paymentMethods);

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  const getCardIcon = (type: string) => {
    const colors: Record<string, string> = {
      visa: 'bg-blue-600',
      mastercard: 'bg-red-500',
      amex: 'bg-gray-700',
    };
    return colors[type] || 'bg-gray-500';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Link to="/settings" className="text-gray-400 hover:text-gray-600 mr-4">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <CreditCard className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">Billing & Payments</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-blue-50 rounded-xl p-6 border border-blue-100 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-700 font-medium">Current Plan</p>
              <h2 className="text-2xl font-bold text-gray-900">Flipper Bundle</h2>
              <p className="text-gray-600">$197/month • Renews Feb 1, 2026</p>
            </div>
            <Link
              to="/pricing"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
            >
              Change Plan
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 mb-8">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Payment Methods</h3>
            <button className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium">
              <Plus className="w-4 h-4" /> Add New
            </button>
          </div>
          <div className="divide-y divide-gray-200">
            {methods.map(method => (
              <div key={method.id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-8 ${getCardIcon(method.type)} rounded flex items-center justify-center text-white text-xs font-bold uppercase`}>
                    {method.type}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">•••• •••• •••• {method.last4}</p>
                    <p className="text-sm text-gray-500">Expires {method.expiry}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {method.isDefault ? (
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium flex items-center gap-1">
                      <Check className="w-3 h-3" /> Default
                    </span>
                  ) : (
                    <button className="text-sm text-blue-600 hover:text-blue-700">Set as default</button>
                  )}
                  <button className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Billing History</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {invoices.map(invoice => (
              <div key={invoice.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full ${
                    invoice.status === 'paid' ? 'bg-green-500' :
                    invoice.status === 'pending' ? 'bg-yellow-500' : 'bg-red-500'
                  }`} />
                  <div>
                    <p className="font-medium text-gray-900">{invoice.description}</p>
                    <p className="text-sm text-gray-500">{invoice.id} • {invoice.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-semibold text-gray-900">{formatCurrency(invoice.amount)}</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${
                    invoice.status === 'paid' ? 'bg-green-100 text-green-700' :
                    invoice.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {invoice.status}
                  </span>
                  <button className="p-2 text-gray-400 hover:text-gray-600">
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-800">Need to cancel?</p>
            <p className="text-sm text-yellow-700">
              You can cancel your subscription anytime from your{' '}
              <Link to="/settings" className="underline">account settings</Link>.
              Your access will continue until the end of your billing period.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
