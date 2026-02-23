import { Link } from 'react-router-dom';
import { Building2, ArrowLeft, Newspaper, Download, ExternalLink, Mail, Image, FileText } from 'lucide-react';

const pressReleases = [
  { date: 'Jan 28, 2026', title: 'JediRe Raises $50M Series B to Expand AI-Powered Real Estate Platform', link: '#' },
  { date: 'Dec 15, 2025', title: 'JediRe Launches Multi-Agent Analysis Feature', link: '#' },
  { date: 'Oct 1, 2025', title: 'JediRe Surpasses 10,000 Active Users', link: '#' },
  { date: 'Aug 15, 2025', title: 'JediRe Named Best PropTech Startup by RealEstate Weekly', link: '#' },
];

const mediaKit = [
  { name: 'Logo Pack', description: 'PNG, SVG, and EPS formats', type: 'ZIP', size: '2.4 MB' },
  { name: 'Product Screenshots', description: 'High-res app screenshots', type: 'ZIP', size: '15 MB' },
  { name: 'Executive Headshots', description: 'Leadership team photos', type: 'ZIP', size: '8 MB' },
  { name: 'Brand Guidelines', description: 'Colors, typography, usage rules', type: 'PDF', size: '4.2 MB' },
];

const coverage = [
  { outlet: 'TechCrunch', title: 'How JediRe is Using AI to Democratize Real Estate Investment', date: 'Jan 2026' },
  { outlet: 'Forbes', title: 'The PropTech Startups to Watch in 2026', date: 'Jan 2026' },
  { outlet: 'Real Estate Weekly', title: 'JediRe Review: A Game-Changer for Property Analysis', date: 'Dec 2025' },
  { outlet: 'Bloomberg', title: 'AI Meets Real Estate: The New Wave of Investment Tools', date: 'Nov 2025' },
];

export default function PressPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Link to="/" className="text-gray-400 hover:text-gray-600 mr-4">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Newspaper className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">Press & Media</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-gradient-to-r from-gray-900 to-blue-900 rounded-xl p-8 text-white mb-8">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-bold mb-4">Press & Media Kit</h1>
            <p className="text-white/80 mb-6">
              Get the latest news, resources, and assets for media coverage of JediRe.
            </p>
            <a href="mailto:press@jedire.com" className="inline-flex items-center gap-2 px-4 py-2 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100">
              <Mail className="w-4 h-4" /> Contact Press Team
            </a>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-gray-400" /> Press Releases
            </h2>
            <div className="space-y-4">
              {pressReleases.map((pr, i) => (
                <a key={i} href={pr.link} className="block p-3 rounded-lg hover:bg-gray-50">
                  <p className="text-sm text-gray-500 mb-1">{pr.date}</p>
                  <p className="font-medium text-gray-900 flex items-center gap-2">
                    {pr.title} <ExternalLink className="w-4 h-4 text-gray-400" />
                  </p>
                </a>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Newspaper className="w-5 h-5 text-gray-400" /> Media Coverage
            </h2>
            <div className="space-y-4">
              {coverage.map((item, i) => (
                <div key={i} className="p-3 rounded-lg hover:bg-gray-50">
                  <p className="text-sm text-blue-600 font-medium mb-1">{item.outlet}</p>
                  <p className="text-gray-900">{item.title}</p>
                  <p className="text-sm text-gray-500">{item.date}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200 mb-8">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Image className="w-5 h-5 text-gray-400" /> Media Kit Downloads
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {mediaKit.map((item, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{item.name}</p>
                  <p className="text-sm text-gray-500">{item.description}</p>
                </div>
                <button className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">
                  <Download className="w-4 h-4" /> {item.size}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
          <h2 className="font-semibold text-gray-900 mb-2">Press Inquiries</h2>
          <p className="text-gray-600 mb-4">
            For press inquiries, interviews, or additional information, please contact our press team.
          </p>
          <div className="flex flex-wrap gap-4">
            <a href="mailto:press@jedire.com" className="text-blue-600 hover:text-blue-700 font-medium">press@jedire.com</a>
            <span className="text-gray-400">|</span>
            <span className="text-gray-600">Response time: 24-48 hours</span>
          </div>
        </div>
      </main>
    </div>
  );
}
