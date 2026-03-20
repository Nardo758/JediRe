import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, Menu, Code, Key, Zap, Terminal, 
  Webhook, Package, MessageCircle, Clock, Copy, Check
} from 'lucide-react';

const navSections = [
  { id: 'quickstart', label: 'Quick Start', icon: Zap },
  { id: 'authentication', label: 'Authentication', icon: Key },
  { id: 'endpoints', label: 'Endpoints', icon: Terminal },
  { id: 'examples', label: 'Code Examples', icon: Code },
  { id: 'rate-limits', label: 'Rate Limits', icon: Clock },
  { id: 'webhooks', label: 'Webhooks', icon: Webhook },
  { id: 'sdks', label: 'SDKs', icon: Package },
  { id: 'support', label: 'Support', icon: MessageCircle },
];

const endpoints = [
  { method: 'GET', path: '/api/v1/properties', description: 'List all properties' },
  { method: 'GET', path: '/api/v1/properties/:id', description: 'Get property details' },
  { method: 'POST', path: '/api/v1/properties/analyze', description: 'Analyze a property' },
  { method: 'GET', path: '/api/v1/zoning/lookup', description: 'Lookup zoning by address' },
  { method: 'GET', path: '/api/v1/markets', description: 'List available markets' },
  { method: 'GET', path: '/api/v1/agents/insights', description: 'Get AI agent insights' },
];

const pythonExample = `import jedire

client = jedire.Client(api_key="your_api_key")

# Analyze a property
result = client.properties.analyze(
    address="123 Main St, Austin, TX"
)

print(result.zoning)
print(result.development_potential)
print(result.strategies)`;

const jsExample = `import JediRe from '@jedire/sdk';

const client = new JediRe({ apiKey: 'your_api_key' });

// Analyze a property
const result = await client.properties.analyze({
  address: '123 Main St, Austin, TX'
});

console.log(result.zoning);
console.log(result.developmentPotential);
console.log(result.strategies);`;

const curlExample = `curl -X POST https://api.jedire.com/v1/properties/analyze \\
  -H "Authorization: Bearer your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "address": "123 Main St, Austin, TX"
  }'`;

export default function ApiDocsPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('quickstart');
  const [codeTab, setCodeTab] = useState<'python' | 'javascript' | 'curl'>('python');
  const [copied, setCopied] = useState(false);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <Building2 className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">JediRe</span>
              <span className="text-gray-400 mx-2">|</span>
              <span className="text-gray-600">API Docs</span>
            </Link>

            <div className="hidden md:flex items-center gap-4">
              <Link to="/help" className="text-gray-600 hover:text-gray-900 text-sm">Help Center</Link>
              <a href="https://status.jedire.com" className="text-gray-600 hover:text-gray-900 text-sm">Status</a>
              <Link to="/auth" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
                Get API Key
              </Link>
            </div>

            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2">
              <Menu className="w-6 h-6 text-gray-600" />
            </button>
          </div>
        </div>
      </header>

      <div className="pt-16 flex">
        <aside className="hidden lg:block w-64 fixed left-0 top-16 bottom-0 bg-white border-r border-gray-200 overflow-y-auto">
          <nav className="p-4 space-y-1">
            {navSections.map((section) => (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm ${
                  activeSection === section.id
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <section.icon className="w-4 h-4" />
                {section.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 lg:ml-64 p-8">
          <div className="max-w-4xl mx-auto">
            <section className="mb-16 text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Code className="w-8 h-8 text-blue-600" />
              </div>
              <h1 className="text-4xl font-bold text-gray-900 mb-4">Build with JediRe</h1>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Integrate real estate intelligence into your applications with our powerful API
              </p>
            </section>

            <section id="quickstart" className="mb-16">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                <Zap className="w-6 h-6 text-yellow-500" /> Quick Start
              </h2>
              <div className="bg-white rounded-xl p-6 border border-gray-200">
                <ol className="space-y-4">
                  <li className="flex gap-4">
                    <span className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">1</span>
                    <div>
                      <h3 className="font-semibold text-gray-900">Get your API key</h3>
                      <p className="text-gray-600 text-sm">Sign up and generate an API key from your dashboard</p>
                    </div>
                  </li>
                  <li className="flex gap-4">
                    <span className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">2</span>
                    <div>
                      <h3 className="font-semibold text-gray-900">Install the SDK</h3>
                      <div className="bg-gray-900 text-gray-100 rounded-lg p-3 mt-2 font-mono text-sm">
                        pip install jedire
                      </div>
                    </div>
                  </li>
                  <li className="flex gap-4">
                    <span className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">3</span>
                    <div>
                      <h3 className="font-semibold text-gray-900">Make your first request</h3>
                      <p className="text-gray-600 text-sm">Analyze properties, lookup zoning, and get AI insights</p>
                    </div>
                  </li>
                </ol>
              </div>
            </section>

            <section id="authentication" className="mb-16">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                <Key className="w-6 h-6 text-purple-500" /> Authentication
              </h2>
              <div className="bg-white rounded-xl p-6 border border-gray-200 space-y-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">API Keys</h3>
                  <p className="text-gray-600 text-sm mb-3">
                    Include your API key in the Authorization header of all requests.
                  </p>
                  <div className="bg-gray-900 text-gray-100 rounded-lg p-3 font-mono text-sm">
                    Authorization: Bearer your_api_key
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">OAuth 2.0</h3>
                  <p className="text-gray-600 text-sm">
                    For apps accessing user data, implement OAuth 2.0 with our authorization server.
                    Supports authorization code and refresh token flows.
                  </p>
                </div>
              </div>
            </section>

            <section id="endpoints" className="mb-16">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                <Terminal className="w-6 h-6 text-green-500" /> Endpoints
              </h2>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                  <p className="text-sm text-gray-600">Base URL: <code className="bg-gray-200 px-2 py-1 rounded">https://api.jedire.com/v1</code></p>
                </div>
                <div className="divide-y divide-gray-200">
                  {endpoints.map((endpoint, i) => (
                    <div key={i} className="p-4 flex items-center gap-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        endpoint.method === 'GET' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {endpoint.method}
                      </span>
                      <code className="text-sm font-mono text-gray-900 flex-1">{endpoint.path}</code>
                      <span className="text-sm text-gray-500">{endpoint.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section id="examples" className="mb-16">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                <Code className="w-6 h-6 text-blue-500" /> Code Examples
              </h2>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex border-b border-gray-200">
                  {(['python', 'javascript', 'curl'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setCodeTab(tab)}
                      className={`px-4 py-3 text-sm font-medium capitalize ${
                        codeTab === tab
                          ? 'bg-gray-900 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <button
                    onClick={() => copyCode(codeTab === 'python' ? pythonExample : codeTab === 'javascript' ? jsExample : curlExample)}
                    className="absolute top-3 right-3 p-2 bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <pre className="bg-gray-900 text-gray-100 p-4 overflow-x-auto font-mono text-sm">
                    {codeTab === 'python' && pythonExample}
                    {codeTab === 'javascript' && jsExample}
                    {codeTab === 'curl' && curlExample}
                  </pre>
                </div>
              </div>
            </section>

            <section id="rate-limits" className="mb-16">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                <Clock className="w-6 h-6 text-orange-500" /> Rate Limits
              </h2>
              <div className="bg-white rounded-xl p-6 border border-gray-200">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 text-gray-900 font-semibold">Plan</th>
                      <th className="text-left py-3 text-gray-900 font-semibold">Requests/min</th>
                      <th className="text-left py-3 text-gray-900 font-semibold">Requests/day</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr>
                      <td className="py-3 text-gray-600">Free</td>
                      <td className="py-3 text-gray-600">10</td>
                      <td className="py-3 text-gray-600">100</td>
                    </tr>
                    <tr>
                      <td className="py-3 text-gray-600">Starter</td>
                      <td className="py-3 text-gray-600">60</td>
                      <td className="py-3 text-gray-600">5,000</td>
                    </tr>
                    <tr>
                      <td className="py-3 text-gray-600">Professional</td>
                      <td className="py-3 text-gray-600">300</td>
                      <td className="py-3 text-gray-600">50,000</td>
                    </tr>
                    <tr>
                      <td className="py-3 text-gray-600">Enterprise</td>
                      <td className="py-3 text-gray-600">Custom</td>
                      <td className="py-3 text-gray-600">Unlimited</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section id="webhooks" className="mb-16">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                <Webhook className="w-6 h-6 text-pink-500" /> Webhooks
              </h2>
              <div className="bg-white rounded-xl p-6 border border-gray-200">
                <p className="text-gray-600 mb-4">
                  Receive real-time notifications when events occur in your account.
                </p>
                <h3 className="font-semibold text-gray-900 mb-2">Available Events</h3>
                <ul className="space-y-2 text-gray-600 text-sm">
                  <li>• <code className="bg-gray-100 px-2 py-0.5 rounded">property.analyzed</code> - Property analysis completed</li>
                  <li>• <code className="bg-gray-100 px-2 py-0.5 rounded">alert.triggered</code> - Investment alert triggered</li>
                  <li>• <code className="bg-gray-100 px-2 py-0.5 rounded">market.updated</code> - Market data updated</li>
                  <li>• <code className="bg-gray-100 px-2 py-0.5 rounded">agent.insight</code> - New AI agent insight</li>
                </ul>
              </div>
            </section>

            <section id="sdks" className="mb-16">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                <Package className="w-6 h-6 text-indigo-500" /> SDKs & Libraries
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { name: 'Python', cmd: 'pip install jedire', version: 'v2.1.0' },
                  { name: 'JavaScript/Node', cmd: 'npm install @jedire/sdk', version: 'v2.1.0' },
                  { name: 'Ruby', cmd: 'gem install jedire', version: 'v1.5.0' },
                  { name: 'Go', cmd: 'go get github.com/jedire/go-sdk', version: 'v1.3.0' },
                ].map((sdk, i) => (
                  <div key={i} className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-900">{sdk.name}</h3>
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">{sdk.version}</span>
                    </div>
                    <code className="text-sm bg-gray-100 px-3 py-2 rounded block text-gray-700">{sdk.cmd}</code>
                  </div>
                ))}
              </div>
            </section>

            <section id="support" className="mb-16">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                <MessageCircle className="w-6 h-6 text-teal-500" /> Support
              </h2>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl p-6 border border-gray-200 text-center">
                  <h3 className="font-semibold text-gray-900 mb-2">Documentation</h3>
                  <p className="text-gray-600 text-sm mb-4">Comprehensive guides and references</p>
                  <Link to="/help" className="text-blue-600 hover:text-blue-700 font-medium text-sm">
                    View Docs →
                  </Link>
                </div>
                <div className="bg-white rounded-xl p-6 border border-gray-200 text-center">
                  <h3 className="font-semibold text-gray-900 mb-2">Developer Forum</h3>
                  <p className="text-gray-600 text-sm mb-4">Community support and discussions</p>
                  <a href="#" className="text-blue-600 hover:text-blue-700 font-medium text-sm">
                    Join Forum →
                  </a>
                </div>
                <div className="bg-white rounded-xl p-6 border border-gray-200 text-center">
                  <h3 className="font-semibold text-gray-900 mb-2">Priority Support</h3>
                  <p className="text-gray-600 text-sm mb-4">Direct engineering support</p>
                  <Link to="/contact" className="text-blue-600 hover:text-blue-700 font-medium text-sm">
                    Contact Us →
                  </Link>
                </div>
              </div>
            </section>

            <section className="mb-16">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Changelog</h2>
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-200">
                {[
                  { version: 'v2.1.0', date: 'Jan 28, 2026', changes: ['Added AI agent insights endpoint', 'Improved rate limit headers', 'Bug fixes'] },
                  { version: 'v2.0.0', date: 'Jan 15, 2026', changes: ['New zoning lookup API', 'Strategy analysis endpoints', 'Breaking: Auth header format change'] },
                  { version: 'v1.9.0', date: 'Dec 20, 2025', changes: ['Webhook support', 'Market data endpoints', 'Performance improvements'] },
                ].map((release, i) => (
                  <div key={i} className="p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-semibold text-gray-900">{release.version}</span>
                      <span className="text-sm text-gray-500">{release.date}</span>
                    </div>
                    <ul className="text-sm text-gray-600 space-y-1">
                      {release.changes.map((change, j) => (
                        <li key={j}>• {change}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
