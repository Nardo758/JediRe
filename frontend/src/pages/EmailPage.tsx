import React from 'react';

export function EmailPage() {
  const emails = [
    { from: 'broker@example.com', subject: 'New listing in Buckhead', preview: 'Check out this amazing property...', unread: true },
    { from: 'owner@example.com', subject: 'RE: Offer on 123 Main St', preview: 'We accept your offer of...', unread: true },
    { from: 'team@jedi.com', subject: 'Weekly Market Report', preview: 'Here are this week\'s market insights...', unread: false },
  ];

  return (
    <div className="h-full flex">
      {/* Email List */}
      <div className="w-96 border-r border-gray-200 bg-white overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            ✉️ Compose
          </button>
        </div>

        <div className="divide-y divide-gray-200">
          {emails.map((email, idx) => (
            <div key={idx} className={`p-4 hover:bg-gray-50 cursor-pointer ${email.unread ? 'bg-blue-50' : ''}`}>
              <div className="flex items-start justify-between mb-1">
                <div className="font-medium text-gray-900">{email.from}</div>
                {email.unread && <div className="w-2 h-2 bg-blue-600 rounded-full"></div>}
              </div>
              <div className="font-medium text-sm text-gray-900 mb-1">{email.subject}</div>
              <div className="text-sm text-gray-600 truncate">{email.preview}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Email View */}
      <div className="flex-1 bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">📧</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Email Integration</h3>
          <p className="text-gray-600 max-w-md">
            Connect your email to automatically extract property details and link them to deals.
          </p>
          <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Connect Email
          </button>
        </div>
      </div>
    </div>
  );
}
