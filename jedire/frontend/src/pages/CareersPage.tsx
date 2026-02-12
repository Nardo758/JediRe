import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, Menu, ChevronRight, ChevronDown, Rocket, TrendingUp, 
  Lightbulb, Star, Users, DollarSign, MapPin, Briefcase
} from 'lucide-react';

interface WhyCard {
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface BenefitCategory {
  title: string;
  items: string[];
}

interface Job {
  title: string;
  department: string;
  location: string;
  type: string;
}

interface HiringStep {
  step: number;
  title: string;
  description: string;
  duration: string;
}

const whyCards: WhyCard[] = [
  { icon: <Rocket className="w-6 h-6" />, title: 'Mission Driven', description: 'Democratize RE intelligence for all investors' },
  { icon: <TrendingUp className="w-6 h-6" />, title: 'Growth', description: 'Fast-growing Series B funded, 5x growth in 18 months' },
  { icon: <Lightbulb className="w-6 h-6" />, title: 'Innovation', description: 'AI-first. Solve hard problems daily' },
  { icon: <Star className="w-6 h-6" />, title: 'Impact', description: 'Help 5,000+ investors find $2.4B in opportunities' },
  { icon: <Users className="w-6 h-6" />, title: 'Team', description: 'World-class engineers & data scientists' },
  { icon: <DollarSign className="w-6 h-6" />, title: 'Compensation', description: 'Competitive salary + equity. Full benefits' },
];

const benefits: BenefitCategory[] = [
  { title: 'Health & Wellness', items: ['Medical, dental, vision (100% covered)', 'Mental health support & counseling', 'Gym membership reimbursement', 'Annual wellness stipend'] },
  { title: 'Work-Life Balance', items: ['Unlimited PTO (4 weeks minimum encouraged)', 'Flexible remote work', 'Parental leave (16 weeks paid)', 'Work from anywhere 4 weeks/year'] },
  { title: 'Financial', items: ['Competitive salary', 'Meaningful equity', '401(k) with company match', 'Annual bonus potential'] },
  { title: 'Professional Development', items: ['$2,500 annual learning budget', 'Conference attendance', 'Internal tech talks', 'Mentorship program'] },
  { title: 'Other Perks', items: ['Latest MacBook Pro', 'Home office stipend', 'Team offsites (2x/year)', 'Commuter benefits'] },
];

const jobs: Job[] = [
  { title: 'Senior Full-Stack Engineer (React/Node)', department: 'Engineering', location: 'SF or Remote', type: 'Full-time' },
  { title: 'ML Engineer - AI Agents', department: 'Engineering', location: 'SF or Remote', type: 'Full-time' },
  { title: 'Backend Engineer (Python)', department: 'Engineering', location: 'SF or Remote', type: 'Full-time' },
  { title: 'Staff Frontend Engineer', department: 'Engineering', location: 'SF', type: 'Full-time' },
  { title: 'DevOps Engineer', department: 'Engineering', location: 'Remote', type: 'Full-time' },
  { title: 'Senior Data Scientist', department: 'Data', location: 'SF or Remote', type: 'Full-time' },
  { title: 'Data Engineer', department: 'Data', location: 'Remote', type: 'Full-time' },
  { title: 'ML Research Scientist', department: 'Data', location: 'SF', type: 'Full-time' },
  { title: 'Senior Product Manager', department: 'Product', location: 'SF', type: 'Full-time' },
  { title: 'Product Designer', department: 'Product', location: 'SF or Remote', type: 'Full-time' },
  { title: 'UX Researcher', department: 'Product', location: 'Remote', type: 'Full-time' },
  { title: 'Account Executive (Enterprise Sales)', department: 'Business', location: 'SF or NYC', type: 'Full-time' },
  { title: 'Customer Success Manager', department: 'Business', location: 'Remote', type: 'Full-time' },
  { title: 'Marketing Manager', department: 'Business', location: 'SF or Remote', type: 'Full-time' },
];

const hiringSteps: HiringStep[] = [
  { step: 1, title: 'Application Review', description: 'Resume and cover letter review', duration: '2-3 days' },
  { step: 2, title: 'Recruiter Call', description: '30-minute culture and role fit discussion', duration: '30 min' },
  { step: 3, title: 'Technical Screen', description: 'Role-specific skills assessment', duration: '1 hour' },
  { step: 4, title: 'Onsite/Virtual', description: 'Meet the team, deep-dive technical and behavioral', duration: '3-4 hours' },
  { step: 5, title: 'Offer', description: 'Competitive offer with equity', duration: '2-3 days' },
];

const departments = ['All Teams', 'Engineering', 'Data', 'Product', 'Business'];
const locations = ['All Locations', 'SF', 'Remote', 'NYC'];

export default function CareersPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState('All Teams');
  const [selectedLocation, setSelectedLocation] = useState('All Locations');

  const filteredJobs = jobs.filter(job => {
    const matchesDept = selectedDepartment === 'All Teams' || job.department === selectedDepartment;
    const matchesLocation = selectedLocation === 'All Locations' || job.location.includes(selectedLocation);
    return matchesDept && matchesLocation;
  });

  const groupedJobs = filteredJobs.reduce((acc, job) => {
    if (!acc[job.department]) acc[job.department] = [];
    acc[job.department].push(job);
    return acc;
  }, {} as Record<string, Job[]>);

  return (
    <div className="min-h-screen bg-white">
      <header className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-b border-gray-100 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <Building2 className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">JediRe Careers</span>
            </Link>

            <nav className="hidden md:flex items-center gap-8">
              <Link to="/features" className="text-gray-600 hover:text-gray-900 text-sm font-medium">Features</Link>
              <Link to="/pricing" className="text-gray-600 hover:text-gray-900 text-sm font-medium">Pricing</Link>
              <Link to="/about" className="text-gray-600 hover:text-gray-900 text-sm font-medium">About</Link>
              <Link to="/blog" className="text-gray-600 hover:text-gray-900 text-sm font-medium">Blog</Link>
            </nav>

            <div className="hidden md:flex items-center gap-4">
              <a href="#positions" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
                Apply Now
              </a>
            </div>

            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2">
              <Menu className="w-6 h-6 text-gray-600" />
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 py-4">
            <div className="px-4 space-y-3">
              <Link to="/features" className="block text-gray-600 font-medium">Features</Link>
              <Link to="/pricing" className="block text-gray-600 font-medium">Pricing</Link>
              <Link to="/about" className="block text-gray-600 font-medium">About</Link>
              <Link to="/blog" className="block text-gray-600 font-medium">Blog</Link>
              <hr className="border-gray-200" />
              <a href="#positions" className="block w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-center">Apply Now</a>
            </div>
          </div>
        )}
      </header>

      <section className="pt-28 pb-16 bg-gradient-to-br from-purple-600 to-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            Build the Future of Real Estate Investing
          </h1>
          <p className="text-xl text-white/80 max-w-2xl mx-auto mb-8">
            Join our mission to democratize real estate intelligence through AI and help investors make smarter decisions
          </p>
          <a href="#positions" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-600 rounded-xl font-semibold text-lg hover:bg-gray-100">
            View Open Positions <ChevronDown className="w-5 h-5" />
          </a>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">Why JediRe?</h2>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {whyCards.map((card, i) => (
              <div key={i} className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 mb-4">
                  {card.icon}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{card.title}</h3>
                <p className="text-gray-600 text-sm">{card.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">Benefits & Perks</h2>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((category, i) => (
              <div key={i} className="bg-white rounded-xl p-6 border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-4">{category.title}</h3>
                <ul className="space-y-2">
                  {category.items.map((item, j) => (
                    <li key={j} className="text-gray-600 text-sm flex items-start gap-2">
                      <span className="text-green-500">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="positions" className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-8">Open Positions</h2>
          
          <div className="flex flex-wrap gap-4 mb-8">
            <div className="relative">
              <select
                id="careers-department-filter"
                name="careersDepartmentFilter"
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                aria-label="Filter by department"
                className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-10 text-sm focus:ring-2 focus:ring-blue-500"
              >
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
            
            <div className="relative">
              <select
                id="careers-location-filter"
                name="careersLocationFilter"
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                aria-label="Filter by location"
                className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-10 text-sm focus:ring-2 focus:ring-blue-500"
              >
                {locations.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div className="space-y-8">
            {Object.entries(groupedJobs).map(([department, deptJobs]) => (
              <div key={department}>
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-gray-400" />
                  {department}
                </h3>
                <div className="space-y-2">
                  {deptJobs.map((job, i) => (
                    <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between hover:border-blue-300 transition-colors">
                      <div>
                        <h4 className="font-medium text-gray-900">{job.title}</h4>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-sm text-gray-500 flex items-center gap-1">
                            <MapPin className="w-4 h-4" /> {job.location}
                          </span>
                        </div>
                      </div>
                      <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
                        Apply
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {filteredJobs.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No positions found matching your filters.
            </div>
          )}

          <div className="mt-8 text-center">
            <p className="text-gray-600 mb-4">Don't see a fit?</p>
            <button className="text-blue-600 hover:text-blue-700 font-medium">
              Send us your resume anyway →
            </button>
          </div>
        </div>
      </section>

      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-4">Our Hiring Process</h2>
          <p className="text-center text-gray-600 mb-12">2-3 weeks from application to offer</p>
          
          <div className="space-y-4">
            {hiringSteps.map((step, i) => (
              <div key={i} className="bg-white rounded-xl p-6 border border-gray-200 flex items-start gap-4">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                  {step.step}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">{step.title}</h3>
                    <span className="text-sm text-gray-500">{step.duration}</span>
                  </div>
                  <p className="text-gray-600 text-sm mt-1">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Join Us?</h2>
          <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
            We're building something special. Come be a part of it.
          </p>
          <a href="#positions" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-600 rounded-xl font-semibold text-lg hover:bg-gray-100">
            View Open Positions <ChevronRight className="w-5 h-5" />
          </a>
        </div>
      </section>

      <footer className="py-12 bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-6 h-6 text-blue-500" />
              <span className="text-lg font-bold text-white">JediRe</span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <Link to="/" className="hover:text-white">Home</Link>
              <Link to="/about" className="hover:text-white">About</Link>
              <Link to="/careers" className="hover:text-white">Careers</Link>
              <Link to="/contact" className="hover:text-white">Contact</Link>
            </div>
            <p className="text-sm">© 2026 JediRe. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
