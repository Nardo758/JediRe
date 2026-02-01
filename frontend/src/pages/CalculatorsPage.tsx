import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ArrowLeft, Calculator, DollarSign, Percent, Home, TrendingUp } from 'lucide-react';

type CalculatorType = 'roi' | 'mortgage' | 'cashflow' | 'caprate';

export default function CalculatorsPage() {
  const [activeCalc, setActiveCalc] = useState<CalculatorType>('roi');
  
  const [roiInputs, setRoiInputs] = useState({ purchase: 400000, repairs: 50000, arv: 550000, holdingCosts: 15000, sellingCosts: 33000 });
  const [mortgageInputs, setMortgageInputs] = useState({ price: 400000, downPayment: 20, interestRate: 7, term: 30 });
  const [cashflowInputs, setCashflowInputs] = useState({ rent: 2500, mortgage: 1800, taxes: 300, insurance: 150, maintenance: 200, vacancy: 125, management: 250 });
  const [caprateInputs, setCaprateInputs] = useState({ noi: 36000, price: 500000 });

  const calcROI = () => {
    const totalInvestment = roiInputs.purchase + roiInputs.repairs + roiInputs.holdingCosts;
    const profit = roiInputs.arv - totalInvestment - roiInputs.sellingCosts;
    const roi = (profit / totalInvestment) * 100;
    return { profit, roi, totalInvestment };
  };

  const calcMortgage = () => {
    const principal = mortgageInputs.price * (1 - mortgageInputs.downPayment / 100);
    const monthlyRate = mortgageInputs.interestRate / 100 / 12;
    const payments = mortgageInputs.term * 12;
    const monthly = principal * (monthlyRate * Math.pow(1 + monthlyRate, payments)) / (Math.pow(1 + monthlyRate, payments) - 1);
    return { monthly, principal, totalInterest: (monthly * payments) - principal };
  };

  const calcCashflow = () => {
    const expenses = cashflowInputs.taxes + cashflowInputs.insurance + cashflowInputs.maintenance + cashflowInputs.vacancy + cashflowInputs.management;
    const cashflow = cashflowInputs.rent - cashflowInputs.mortgage - expenses;
    return { cashflow, expenses, annual: cashflow * 12 };
  };

  const calcCapRate = () => {
    return { capRate: (caprateInputs.noi / caprateInputs.price) * 100 };
  };

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Link to="/app" className="text-gray-400 hover:text-gray-600 mr-4">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Calculator className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">Investment Calculators</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-wrap gap-2 mb-8">
          {[
            { id: 'roi', label: 'ROI Calculator', icon: TrendingUp },
            { id: 'mortgage', label: 'Mortgage', icon: Home },
            { id: 'cashflow', label: 'Cash Flow', icon: DollarSign },
            { id: 'caprate', label: 'Cap Rate', icon: Percent },
          ].map(calc => (
            <button
              key={calc.id}
              onClick={() => setActiveCalc(calc.id as CalculatorType)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                activeCalc === calc.id ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <calc.icon className="w-4 h-4" /> {calc.label}
            </button>
          ))}
        </div>

        {activeCalc === 'roi' && (
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Flip ROI Calculator</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-4">
                {[
                  { label: 'Purchase Price', key: 'purchase' },
                  { label: 'Repair Costs', key: 'repairs' },
                  { label: 'After Repair Value (ARV)', key: 'arv' },
                  { label: 'Holding Costs', key: 'holdingCosts' },
                  { label: 'Selling Costs', key: 'sellingCosts' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                      <input
                        type="number"
                        value={roiInputs[field.key as keyof typeof roiInputs]}
                        onChange={(e) => setRoiInputs({ ...roiInputs, [field.key]: Number(e.target.value) })}
                        className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-blue-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Results</h3>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Investment</span>
                    <span className="font-semibold">{formatCurrency(calcROI().totalInvestment)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Profit</span>
                    <span className={`font-semibold ${calcROI().profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(calcROI().profit)}
                    </span>
                  </div>
                  <hr className="border-gray-200" />
                  <div className="flex justify-between items-center">
                    <span className="text-gray-900 font-semibold">ROI</span>
                    <span className={`text-2xl font-bold ${calcROI().roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {calcROI().roi.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeCalc === 'mortgage' && (
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Mortgage Calculator</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                    <input
                      type="number"
                      value={mortgageInputs.price}
                      onChange={(e) => setMortgageInputs({ ...mortgageInputs, price: Number(e.target.value) })}
                      className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Down Payment (%)</label>
                  <input
                    type="number"
                    value={mortgageInputs.downPayment}
                    onChange={(e) => setMortgageInputs({ ...mortgageInputs, downPayment: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Interest Rate (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={mortgageInputs.interestRate}
                    onChange={(e) => setMortgageInputs({ ...mortgageInputs, interestRate: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Loan Term (years)</label>
                  <select
                    value={mortgageInputs.term}
                    onChange={(e) => setMortgageInputs({ ...mortgageInputs, term: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={15}>15 years</option>
                    <option value={20}>20 years</option>
                    <option value={30}>30 years</option>
                  </select>
                </div>
              </div>
              <div className="bg-green-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Results</h3>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Loan Amount</span>
                    <span className="font-semibold">{formatCurrency(calcMortgage().principal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Interest</span>
                    <span className="font-semibold">{formatCurrency(calcMortgage().totalInterest)}</span>
                  </div>
                  <hr className="border-gray-200" />
                  <div className="flex justify-between items-center">
                    <span className="text-gray-900 font-semibold">Monthly Payment</span>
                    <span className="text-2xl font-bold text-green-600">
                      {formatCurrency(calcMortgage().monthly)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeCalc === 'cashflow' && (
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Cash Flow Calculator</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-4">
                {[
                  { label: 'Monthly Rent', key: 'rent' },
                  { label: 'Mortgage Payment', key: 'mortgage' },
                  { label: 'Property Taxes', key: 'taxes' },
                  { label: 'Insurance', key: 'insurance' },
                  { label: 'Maintenance', key: 'maintenance' },
                  { label: 'Vacancy Reserve', key: 'vacancy' },
                  { label: 'Property Management', key: 'management' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                      <input
                        type="number"
                        value={cashflowInputs[field.key as keyof typeof cashflowInputs]}
                        onChange={(e) => setCashflowInputs({ ...cashflowInputs, [field.key]: Number(e.target.value) })}
                        className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-purple-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Results</h3>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Monthly Income</span>
                    <span className="font-semibold">{formatCurrency(cashflowInputs.rent)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Monthly Expenses</span>
                    <span className="font-semibold text-red-600">-{formatCurrency(cashflowInputs.mortgage + calcCashflow().expenses)}</span>
                  </div>
                  <hr className="border-gray-200" />
                  <div className="flex justify-between items-center">
                    <span className="text-gray-900 font-semibold">Monthly Cash Flow</span>
                    <span className={`text-2xl font-bold ${calcCashflow().cashflow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(calcCashflow().cashflow)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Annual Cash Flow</span>
                    <span className={`font-semibold ${calcCashflow().annual >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(calcCashflow().annual)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeCalc === 'caprate' && (
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Cap Rate Calculator</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Annual Net Operating Income (NOI)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                    <input
                      type="number"
                      value={caprateInputs.noi}
                      onChange={(e) => setCaprateInputs({ ...caprateInputs, noi: Number(e.target.value) })}
                      className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Property Price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                    <input
                      type="number"
                      value={caprateInputs.price}
                      onChange={(e) => setCaprateInputs({ ...caprateInputs, price: Number(e.target.value) })}
                      className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
              <div className="bg-orange-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Results</h3>
                <div className="text-center py-8">
                  <div className="text-gray-600 mb-2">Capitalization Rate</div>
                  <div className="text-5xl font-bold text-orange-600">
                    {calcCapRate().capRate.toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
