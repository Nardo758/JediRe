import { Link } from 'react-router-dom';
import { Building2, ArrowLeft, Video, Calendar, Clock, Users, Play, Bell, ExternalLink } from 'lucide-react';

interface Webinar {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  duration: string;
  host: string;
  attendees: number;
  status: 'upcoming' | 'live' | 'recorded';
  image?: string;
}

const webinars: Webinar[] = [
  { id: '1', title: 'Live Q&A: Market Trends 2026', description: 'Ask our analysts anything about current market conditions', date: 'Feb 5, 2026', time: '2:00 PM EST', duration: '1 hour', host: 'Sarah Chen', attendees: 156, status: 'upcoming' },
  { id: '2', title: 'Mastering Multi-Family Analysis', description: 'Deep dive into analyzing multi-family investment opportunities', date: 'Feb 12, 2026', time: '1:00 PM EST', duration: '90 min', host: 'Mike Johnson', attendees: 89, status: 'upcoming' },
  { id: '3', title: 'New Feature Walkthrough: AI Agents', description: 'Learn how to leverage our new AI agent insights', date: 'Jan 28, 2026', time: '3:00 PM EST', duration: '45 min', host: 'JediRe Team', attendees: 234, status: 'recorded' },
  { id: '4', title: 'Zoning Intelligence Workshop', description: 'Hands-on workshop for using zoning analysis tools', date: 'Jan 20, 2026', time: '11:00 AM EST', duration: '2 hours', host: 'Emily Davis', attendees: 178, status: 'recorded' },
  { id: '5', title: 'Beginner\'s Guide to Real Estate Investing', description: 'Everything you need to know to get started', date: 'Jan 15, 2026', time: '2:00 PM EST', duration: '1.5 hours', host: 'Tom Williams', attendees: 312, status: 'recorded' },
];

export default function WebinarsPage() {
  const upcoming = webinars.filter(w => w.status === 'upcoming');
  const recorded = webinars.filter(w => w.status === 'recorded');

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Link to="/" className="text-gray-400 hover:text-gray-600 mr-4">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Video className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">Webinars & Events</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <section className="mb-12">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Upcoming Events</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {upcoming.map(webinar => (
              <div key={webinar.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 h-32 flex items-center justify-center">
                  <Video className="w-12 h-12 text-white/40" />
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">Upcoming</span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{webinar.title}</h3>
                  <p className="text-sm text-gray-500 mb-4">{webinar.description}</p>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-4">
                    <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {webinar.date}</span>
                    <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {webinar.time}</span>
                    <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {webinar.attendees} registered</span>
                  </div>
                  <div className="flex gap-3">
                    <button className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
                      <Bell className="w-4 h-4" /> Register
                    </button>
                    <button className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                      <Calendar className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-6">Recorded Sessions</h2>
          <div className="space-y-4">
            {recorded.map(webinar => (
              <div key={webinar.id} className="bg-white rounded-xl p-6 border border-gray-200 flex flex-col sm:flex-row items-start gap-4">
                <div className="w-full sm:w-48 h-28 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Play className="w-10 h-10 text-gray-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">{webinar.title}</h3>
                  <p className="text-sm text-gray-500 mb-3">{webinar.description}</p>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                    <span>{webinar.date}</span>
                    <span>•</span>
                    <span>{webinar.duration}</span>
                    <span>•</span>
                    <span>Host: {webinar.host}</span>
                    <span>•</span>
                    <span>{webinar.attendees} viewers</span>
                  </div>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
                  <Play className="w-4 h-4" /> Watch
                </button>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
