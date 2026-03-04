import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ArrowLeft, GraduationCap, Play, Clock, Award, CheckCircle, Lock, ChevronRight } from 'lucide-react';

interface Course {
  id: string;
  title: string;
  description: string;
  duration: string;
  lessons: number;
  level: string;
  progress: number;
  locked?: boolean;
}

const courses: Course[] = [
  { id: '1', title: 'Getting Started with JediRe', description: 'Learn the basics of the platform', duration: '45 min', lessons: 5, level: 'Beginner', progress: 100 },
  { id: '2', title: 'Understanding Zoning Analysis', description: 'Master zoning intelligence features', duration: '1.5 hrs', lessons: 8, level: 'Beginner', progress: 60 },
  { id: '3', title: 'Investment Strategy Selection', description: 'Choose the right strategy for each property', duration: '2 hrs', lessons: 10, level: 'Intermediate', progress: 20 },
  { id: '4', title: 'Advanced ROI Calculations', description: 'Deep dive into financial analysis', duration: '2.5 hrs', lessons: 12, level: 'Advanced', progress: 0 },
  { id: '5', title: 'Multi-Agent Analysis Deep Dive', description: 'Leverage AI agents for insights', duration: '2 hrs', lessons: 9, level: 'Advanced', progress: 0, locked: true },
  { id: '6', title: 'Portfolio Management Mastery', description: 'Scale your real estate portfolio', duration: '3 hrs', lessons: 15, level: 'Advanced', progress: 0, locked: true },
];

const certifications = [
  { title: 'JediRe Certified Analyst', earned: true, date: 'Jan 15, 2026' },
  { title: 'Investment Strategy Expert', earned: false },
  { title: 'Advanced Portfolio Manager', earned: false },
];

export default function AcademyPage() {
  const [filter, setFilter] = useState('All');

  const filteredCourses = courses.filter(c => 
    filter === 'All' || c.level === filter
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Link to="/" className="text-gray-400 hover:text-gray-600 mr-4">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <GraduationCap className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">JediRe Academy</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-8 text-white mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">Welcome back!</h2>
              <p className="text-white/80 mb-4">Continue your learning journey</p>
              <div className="flex items-center gap-6">
                <div>
                  <div className="text-3xl font-bold">3/6</div>
                  <div className="text-white/60 text-sm">Courses started</div>
                </div>
                <div>
                  <div className="text-3xl font-bold">1</div>
                  <div className="text-white/60 text-sm">Certification earned</div>
                </div>
              </div>
            </div>
            <div className="hidden md:block">
              <Award className="w-24 h-24 text-white/20" />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {['All', 'Beginner', 'Intermediate', 'Advanced'].map(level => (
            <button
              key={level}
              onClick={() => setFilter(level)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                filter === level ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-200'
              }`}
            >
              {level}
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {filteredCourses.map(course => (
            <div key={course.id} className={`bg-white rounded-xl p-6 border ${course.locked ? 'border-gray-200 opacity-60' : 'border-gray-200 hover:border-blue-300'}`}>
              <div className="flex items-start justify-between mb-3">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  course.level === 'Beginner' ? 'bg-green-100 text-green-700' :
                  course.level === 'Intermediate' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-purple-100 text-purple-700'
                }`}>
                  {course.level}
                </span>
                {course.locked && <Lock className="w-4 h-4 text-gray-400" />}
                {course.progress === 100 && <CheckCircle className="w-5 h-5 text-green-500" />}
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{course.title}</h3>
              <p className="text-sm text-gray-500 mb-4">{course.description}</p>
              <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {course.duration}</span>
                <span>{course.lessons} lessons</span>
              </div>
              {course.progress > 0 && course.progress < 100 && (
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Progress</span>
                    <span>{course.progress}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full" style={{ width: `${course.progress}%` }} />
                  </div>
                </div>
              )}
              <button 
                disabled={course.locked}
                className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg font-medium ${
                  course.locked ? 'bg-gray-100 text-gray-400 cursor-not-allowed' :
                  course.progress === 100 ? 'bg-green-100 text-green-700' :
                  'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {course.locked ? (
                  <>
                    <Lock className="w-4 h-4" /> Upgrade to Unlock
                  </>
                ) : course.progress === 100 ? (
                  <>
                    <CheckCircle className="w-4 h-4" /> Completed
                  </>
                ) : course.progress > 0 ? (
                  <>
                    <Play className="w-4 h-4" /> Continue
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" /> Start Course
                  </>
                )}
              </button>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-4">Certifications</h3>
          <div className="space-y-4">
            {certifications.map((cert, i) => (
              <div key={i} className={`flex items-center justify-between p-4 rounded-lg ${cert.earned ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-3">
                  <Award className={`w-6 h-6 ${cert.earned ? 'text-yellow-600' : 'text-gray-300'}`} />
                  <div>
                    <p className="font-medium text-gray-900">{cert.title}</p>
                    {cert.earned && <p className="text-sm text-gray-500">Earned {cert.date}</p>}
                  </div>
                </div>
                {cert.earned ? (
                  <button className="text-blue-600 text-sm font-medium">View Certificate</button>
                ) : (
                  <span className="text-sm text-gray-400">Complete required courses</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
