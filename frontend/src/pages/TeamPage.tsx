/**
 * Team & Contacts Page
 * Shows contacts from emails and team members
 */

import React, { useState, useEffect } from 'react';
import { Mail, User, Users, Building2, Phone, Calendar, MessageCircle, Filter, Search } from 'lucide-react';

interface Contact {
  email: string;
  name: string;
  organization?: string;
  lastContact: string;
  emailCount: number;
  topics: string[];
  role?: string;
}

export function TeamPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'internal' | 'external' | 'frequent'>('all');
  const [loading, setLoading] = useState(true);

  // Mock data - replace with actual email API call
  useEffect(() => {
    loadContacts();
  }, []);

  useEffect(() => {
    filterContacts();
  }, [searchQuery, selectedFilter, contacts]);

  const loadContacts = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual API call to /api/emails/contacts or similar
      // const response = await fetch('/api/v1/emails/contacts');
      // const data = await response.json();
      
      // Mock data for now
      const mockContacts: Contact[] = [
        {
          email: 'jeremy@example.com',
          name: 'Jeremy Myers',
          organization: 'Partner',
          lastContact: '2026-02-15',
          emailCount: 147,
          topics: ['Deals', 'Development', 'Finance'],
          role: 'Partner'
        },
        {
          email: 'broker@colliers.com',
          name: 'Sarah Johnson',
          organization: 'Colliers International',
          lastContact: '2026-02-14',
          emailCount: 89,
          topics: ['Market Research', 'Properties', 'Comps'],
        },
        {
          email: 'developer@atlanta.com',
          name: 'Mike Chen',
          organization: 'Atlanta Developers Group',
          lastContact: '2026-02-13',
          emailCount: 56,
          topics: ['Development', 'Zoning', 'Permits'],
        },
        {
          email: 'lender@bankofamerica.com',
          name: 'David Martinez',
          organization: 'Bank of America',
          lastContact: '2026-02-12',
          emailCount: 43,
          topics: ['Financing', 'Debt', 'Terms'],
        },
        {
          email: 'architect@designfirm.com',
          name: 'Emily Rodriguez',
          organization: 'Design Firm LLC',
          lastContact: '2026-02-10',
          emailCount: 32,
          topics: ['Design', 'Plans', 'Permits'],
        },
        {
          email: 'contractor@buildco.com',
          name: 'Tom Wilson',
          organization: 'BuildCo Construction',
          lastContact: '2026-02-08',
          emailCount: 28,
          topics: ['Construction', 'Bids', 'Timeline'],
        },
        {
          email: 'attorney@lawfirm.com',
          name: 'Jennifer Lee',
          organization: 'Real Estate Law Group',
          lastContact: '2026-02-07',
          emailCount: 25,
          topics: ['Legal', 'Contracts', 'Due Diligence'],
        },
        {
          email: 'inspector@cityatlanta.gov',
          name: 'Robert Brown',
          organization: 'City of Atlanta',
          lastContact: '2026-02-05',
          emailCount: 19,
          topics: ['Inspections', 'Permits', 'Compliance'],
        },
      ];
      
      setContacts(mockContacts);
    } catch (error) {
      console.error('Error loading contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterContacts = () => {
    let filtered = [...contacts];

    // Apply search
    if (searchQuery) {
      filtered = filtered.filter(
        (contact) =>
          contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          contact.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          contact.organization?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply filter
    if (selectedFilter === 'internal') {
      filtered = filtered.filter((c) => c.role);
    } else if (selectedFilter === 'external') {
      filtered = filtered.filter((c) => !c.role);
    } else if (selectedFilter === 'frequent') {
      filtered = filtered.filter((c) => c.emailCount > 50);
    }

    setFilteredContacts(filtered);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (email: string) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-orange-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-teal-500',
      'bg-red-500',
    ];
    const index = email.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Team & Contacts</h1>
          <p className="text-gray-600">People from your emails and network</p>
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
          <Mail className="w-4 h-4" />
          Sync Emails
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-5 h-5 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">{contacts.length}</span>
          </div>
          <div className="text-sm text-gray-600">Total Contacts</div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <User className="w-5 h-5 text-green-600" />
            <span className="text-2xl font-bold text-gray-900">
              {contacts.filter((c) => c.role).length}
            </span>
          </div>
          <div className="text-sm text-gray-600">Team Members</div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <Building2 className="w-5 h-5 text-purple-600" />
            <span className="text-2xl font-bold text-gray-900">
              {contacts.filter((c) => c.emailCount > 50).length}
            </span>
          </div>
          <div className="text-sm text-gray-600">Frequent Contacts</div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <Mail className="w-5 h-5 text-orange-600" />
            <span className="text-2xl font-bold text-gray-900">
              {contacts.reduce((sum, c) => sum + c.emailCount, 0)}
            </span>
          </div>
          <div className="text-sm text-gray-600">Total Emails</div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            {(['all', 'internal', 'external', 'frequent'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setSelectedFilter(filter)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedFilter === filter
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {filter === 'all' && 'All'}
                {filter === 'internal' && 'Team'}
                {filter === 'external' && 'External'}
                {filter === 'frequent' && 'Frequent'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Contacts List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">
            Contacts ({filteredContacts.length})
          </h2>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <div>Loading contacts...</div>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Mail className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <div className="font-medium mb-2">No contacts found</div>
            <div className="text-sm">
              {searchQuery
                ? 'Try a different search term'
                : 'Sync your emails to see contacts'}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredContacts.map((contact, idx) => (
              <div
                key={idx}
                className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold ${getAvatarColor(
                      contact.email
                    )}`}
                  >
                    {getInitials(contact.name)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="font-semibold text-gray-900">{contact.name}</div>
                      {contact.role && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                          {contact.role}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 mb-1">{contact.email}</div>
                    {contact.organization && (
                      <div className="text-sm text-gray-500 flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {contact.organization}
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="hidden md:flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <div className="font-semibold text-gray-900">{contact.emailCount}</div>
                      <div className="text-xs text-gray-500">Emails</div>
                    </div>
                    <div className="text-center min-w-[100px]">
                      <div className="font-medium text-gray-700">
                        {new Date(contact.lastContact).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-500">Last contact</div>
                    </div>
                  </div>

                  {/* Topics */}
                  <div className="hidden lg:flex gap-1 flex-wrap max-w-xs">
                    {contact.topics.slice(0, 3).map((topic, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Send email"
                    >
                      <Mail className="w-5 h-5" />
                    </button>
                    <button
                      className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="View details"
                    >
                      <MessageCircle className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Banner */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Mail className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <div className="font-medium text-gray-900 mb-1">
              Contacts are synced from your emails
            </div>
            <div className="text-sm text-gray-600">
              People you've emailed about deals, properties, and market research appear here
              automatically. Click "Sync Emails" to refresh.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
