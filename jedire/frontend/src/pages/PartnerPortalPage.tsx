import { Link } from 'react-router-dom';
import { Building2, ArrowLeft, Briefcase, DollarSign, Users, FileText, TrendingUp, Award, ExternalLink } from 'lucide-react';

const stats = [
  { label: 'Total Referrals', value: '24', icon: Users },
  { label: 'Active Clients', value: '18', icon: Briefcase },
  { label: 'Commission Earned', value: '$4,850', icon: DollarSign },
  { label: 'Partner Tier', value: 'Gold', icon: Award },
];

const resources = [
  { title: 'Partner Playbook', description: 'Complete guide to selling JediRe', type: 'PDF' },
  { title: 'Brand Assets', description: 'Logos, screenshots, and marketing materials', type: 'ZIP' },
  { title: 'Co-Marketing Toolkit', description: 'Email templates and social posts', type: 'PDF' },
  { title: 'API Documentation', description: 'Technical integration guides', type: 'LINK' },
];

export default function PartnerPortalPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link to="/" className="text-gray-400 hover:text-gray-600">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-2">
                <Briefcase className="w-8 h-8 text-blue-600" />
                <span className="text-xl font-bold text-gray-900">Partner Portal</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium flex items-center gap-1">
                <Award className="w-4 h-4" /> Gold Partner
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat, i) => (
            <div key={i} className="bg-white rounded-xl p-6 border border-gray-200">
              <stat.icon className="w-8 h-8 text-blue-600 mb-3" />
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-sm text-gray-500">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Commission Structure</h3>
            <div className="space-y-4">
              {[
                { tier: 'Bronze', referrals: '1-10', rate: '15%' },
                { tier: 'Silver', referrals: '11-25', rate: '20%' },
                { tier: 'Gold', referrals: '26-50', rate: '25%', current: true },
                { tier: 'Platinum', referrals: '51+', rate: '30%' },
              ].map((t, i) => (
                <div key={i} className={`flex items-center justify-between p-3 rounded-lg ${t.current ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'}`}>
                  <div className="flex items-center gap-3">
                    {t.current && <Award className="w-4 h-4 text-yellow-600" />}
                    <span className="font-medium text-gray-900">{t.tier}</span>
                    <span className="text-sm text-gray-500">({t.referrals} referrals)</span>
                  </div>
                  <span className="font-bold text-blue-600">{t.rate}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Recent Activity</h3>
            <div className="space-y-4">
              {[
                { action: 'New signup', client: 'Acme Investments', amount: '+$197', date: 'Today' },
                { action: 'Commission paid', client: '-', amount: '+$850', date: 'Jan 28' },
                { action: 'New signup', client: 'Smith Realty', amount: '+$267', date: 'Jan 25' },
                { action: 'Upgrade', client: 'Johnson Holdings', amount: '+$100', date: 'Jan 22' },
              ].map((activity, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="font-medium text-gray-900">{activity.action}</p>
                    {activity.client !== '-' && <p className="text-sm text-gray-500">{activity.client}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-600">{activity.amount}</p>
                    <p className="text-xs text-gray-500">{activity.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-4">Partner Resources</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {resources.map((resource, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900">{resource.title}</p>
                    <p className="text-sm text-gray-500">{resource.description}</p>
                  </div>
                </div>
                <span className="px-2 py-1 bg-gray-200 text-gray-600 rounded text-xs font-medium">
                  {resource.type}
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
