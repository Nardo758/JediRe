import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Building2, Menu, MessageCircle, Mail, Calendar, Phone, 
  BookOpen, Briefcase, ChevronRight, ChevronDown, MapPin
} from 'lucide-react';

interface ContactOption {
  icon: React.ReactNode;
  title: string;
  description: string;
  detail: string;
  buttonText: string;
  buttonAction: () => void;
}

interface FAQ {
  question: string;
  answer: string;
}

interface Office {
  city: string;
  address: string;
  phone: string;
}

const faqs: FAQ[] = [
  { 
    question: 'How quickly can I get started?', 
    answer: 'Immediately! Sign up for free trial and start analyzing properties.' 
  },
  { 
    question: 'Do you offer training?', 
    answer: 'Yes! Free onboarding, video tutorials, and weekly office hours.' 
  },
  { 
    question: 'What if I need help during my trial?', 
    answer: 'Full support available via chat, email, and phone during trial.' 
  },
];

const offices: Office[] = [
  { city: 'Austin, TX', address: '100 Congress Ave, Suite 2000', phone: '(512) 555-0100' },
  { city: 'San Francisco, CA', address: '535 Mission St, Floor 14', phone: '(415) 555-0200' },
  { city: 'New York, NY', address: '1 World Trade Center, Floor 85', phone: '(212) 555-0300' },
];

const inquiryTypes = [
  'Getting started',
  'Technical support',
  'Billing question',
  'Feature request',
  'Enterprise sales',
  'Partnership opportunity',
  'Press inquiry',
  'Other',
];

export default function ContactPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [formData, setFormData] = useState({
    inquiryType: 'Getting started',
    name: '',
    email: '',
    phone: '',
    message: '',
    agreeToEmails: false,
  });
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const contactOptions: ContactOption[] = [
    {
      icon: <MessageCircle className="w-8 h-8 text-blue-600" />,
      title: 'Live Chat',
      description: 'Instant help\nMon-Fri 9-5 ET',
      detail: 'Avg response: < 2 minutes',
      buttonText: 'Start Chat',
      buttonAction: () => {},
    },
    {
      icon: <Mail className="w-8 h-8 text-green-600" />,
      title: 'Email',
      description: 'support@\njedire.com',
      detail: 'Response within 4 hours',
      buttonText: 'Send Email',
      buttonAction: () => window.location.href = 'mailto:support@jedire.com',
    },
    {
      icon: <Calendar className="w-8 h-8 text-purple-600" />,
      title: 'Schedule Demo',
      description: '30-minute\npersonalized walkthrough',
      detail: 'Pick your time',
      buttonText: 'Book Now',
      buttonAction: () => {},
    },
    {
      icon: <Phone className="w-8 h-8 text-orange-600" />,
      title: 'Phone',
      description: '1-800-JEDIRE\n(1-800-533-4731)',
      detail: 'Mon-Fri 9-5 ET',
      buttonText: 'Call Now',
      buttonAction: () => window.location.href = 'tel:1-800-533-4731',
    },
    {
      icon: <BookOpen className="w-8 h-8 text-teal-600" />,
      title: 'Help Center',
      description: 'Self-service\nguides & FAQs',
      detail: '24/7 access',
      buttonText: 'Browse Help',
      buttonAction: () => {},
    },
    {
      icon: <Briefcase className="w-8 h-8 text-indigo-600" />,
      title: 'Sales',
      description: 'Enterprise\nsolutions',
      detail: 'Custom pricing & features',
      buttonText: 'Contact Sales',
      buttonAction: () => navigate('/pricing'),
    },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-b border-gray-100 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <Building2 className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">JediRe</span>
            </Link>

            <nav className="hidden md:flex items-center gap-8">
              <Link to="/features" className="text-gray-600 hover:text-gray-900 text-sm font-medium">Features</Link>
              <Link to="/pricing" className="text-gray-600 hover:text-gray-900 text-sm font-medium">Pricing</Link>
              <Link to="/about" className="text-gray-600 hover:text-gray-900 text-sm font-medium">About</Link>
              <a href="#" className="text-gray-600 hover:text-gray-900 text-sm font-medium">Blog</a>
            </nav>

            <div className="hidden md:flex items-center gap-4">
              <button
                onClick={() => navigate('/auth')}
                className="text-gray-600 hover:text-gray-900 text-sm font-medium"
              >
                Login
              </button>
              <button
                onClick={() => navigate('/auth')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
              >
                Sign Up
              </button>
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2"
            >
              <Menu className="w-6 h-6 text-gray-600" />
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 py-4">
            <div className="px-4 space-y-3">
              <Link to="/features" className="block text-gray-600 hover:text-gray-900 font-medium">Features</Link>
              <Link to="/pricing" className="block text-gray-600 hover:text-gray-900 font-medium">Pricing</Link>
              <Link to="/about" className="block text-gray-600 hover:text-gray-900 font-medium">About</Link>
              <a href="#" className="block text-gray-600 hover:text-gray-900 font-medium">Blog</a>
              <hr className="border-gray-200" />
              <button onClick={() => navigate('/auth')} className="block w-full text-left text-gray-600 font-medium">Login</button>
              <button onClick={() => navigate('/auth')} className="block w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-center">Sign Up</button>
            </div>
          </div>
        )}
      </header>

      <section className="pt-28 pb-12 bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            We're Here to Help
          </h1>
          <p className="text-xl text-gray-600">
            Get answers, support, or schedule a demo
          </p>
        </div>
      </section>

      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {contactOptions.map((option, i) => (
              <div key={i} className="bg-white rounded-xl p-6 border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all">
                <div className="mb-4">{option.icon}</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{option.title}</h3>
                <p className="text-gray-600 text-sm whitespace-pre-line mb-2">{option.description}</p>
                <p className="text-gray-500 text-xs mb-4">{option.detail}</p>
                <button
                  onClick={option.buttonAction}
                  className="w-full py-2 bg-gray-100 hover:bg-blue-600 hover:text-white text-gray-700 rounded-lg text-sm font-medium transition-colors"
                >
                  {option.buttonText}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-xl p-8 border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Send Us a Message</h2>
            
            {submitted ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Message Sent!</h3>
                <p className="text-gray-600">We'll get back to you within 4 hours.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">I'm interested in:</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setDropdownOpen(!dropdownOpen)}
                      className="w-full px-4 py-3 text-left bg-white border border-gray-300 rounded-lg flex items-center justify-between hover:border-gray-400"
                    >
                      <span>{formData.inquiryType}</span>
                      <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {dropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-64 overflow-auto">
                        {inquiryTypes.map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, inquiryType: type });
                              setDropdownOpen(false);
                            }}
                            className={`w-full px-4 py-2 text-left hover:bg-gray-50 ${formData.inquiryType === type ? 'bg-blue-50 text-blue-600' : 'text-gray-700'}`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="John Smith"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="john@example.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone (optional)</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(555) 123-4567"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
                  <textarea
                    required
                    rows={4}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="I'd like to learn more about..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>

                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="agree"
                    checked={formData.agreeToEmails}
                    onChange={(e) => setFormData({ ...formData, agreeToEmails: e.target.checked })}
                    className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="agree" className="text-sm text-gray-600">
                    I agree to receive product updates and marketing emails
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-lg"
                >
                  Send Message
                </button>

                <p className="text-center text-sm text-gray-500">
                  We typically respond within 4 hours during business hours.
                </p>
              </form>
            )}
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Answers</h2>
          
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-white rounded-xl p-6 border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-2">Q: {faq.question}</h3>
                <p className="text-gray-600">A: {faq.answer}</p>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <button className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              View All FAQs <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      <section className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Office Locations</h2>
          
          <div className="grid sm:grid-cols-3 gap-6">
            {offices.map((office, i) => (
              <div key={i} className="bg-white rounded-xl p-6 border border-gray-200 text-center">
                <MapPin className="w-8 h-8 text-blue-600 mx-auto mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">{office.city}</h3>
                <p className="text-gray-600 text-sm mb-1">{office.address}</p>
                <p className="text-gray-500 text-sm">{office.phone}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="py-12 bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-6 h-6 text-blue-500" />
                <span className="text-lg font-bold text-white">JediRe</span>
              </div>
              <p className="text-sm">AI-Powered Real Estate Intelligence</p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/features" className="hover:text-white">Features</Link></li>
                <li><Link to="/pricing" className="hover:text-white">Pricing</Link></li>
                <li><a href="#" className="hover:text-white">API</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/about" className="hover:text-white">About</Link></li>
                <li><a href="#" className="hover:text-white">Blog</a></li>
                <li><Link to="/contact" className="hover:text-white">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">Privacy</a></li>
                <li><a href="#" className="hover:text-white">Terms</a></li>
                <li><a href="#" className="hover:text-white">Security</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-sm text-center">
            © 2026 JediRe. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
