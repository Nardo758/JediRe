import { Link } from 'react-router-dom';
import { Building2, ArrowLeft, Shield, Mail } from 'lucide-react';

export default function DmcaPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Link to="/" className="text-gray-400 hover:text-gray-600 mr-4">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Shield className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">DMCA Notice</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl p-8 border border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">DMCA Copyright Notice</h1>
          <p className="text-sm text-gray-500 mb-8">Last updated: February 1, 2026</p>

          <div className="prose prose-gray max-w-none">
            <p className="text-gray-600 mb-6">
              JediRe respects the intellectual property rights of others and expects its users to do the same. 
              In accordance with the Digital Millennium Copyright Act of 1998 ("DMCA"), we will respond 
              expeditiously to claims of copyright infringement committed using our service.
            </p>

            <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">Notification of Infringement</h2>
            <p className="text-gray-600 mb-4">
              If you believe that your copyrighted work has been copied in a way that constitutes 
              copyright infringement and is accessible via our service, please notify our copyright 
              agent as set forth below. For your complaint to be valid under the DMCA, you must 
              provide the following information in writing:
            </p>
            <ol className="list-decimal list-inside text-gray-600 mb-6 space-y-2">
              <li>A physical or electronic signature of a person authorized to act on behalf of the copyright owner</li>
              <li>Identification of the copyrighted work claimed to have been infringed</li>
              <li>Identification of the material that is claimed to be infringing and where it is located</li>
              <li>Your contact information (address, telephone number, and email address)</li>
              <li>A statement that you have a good faith belief that use of the material is not authorized</li>
              <li>A statement, under penalty of perjury, that the information provided is accurate</li>
            </ol>

            <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">DMCA Agent</h2>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 mb-6">
              <p className="text-gray-700 mb-2"><strong>DMCA Agent</strong></p>
              <p className="text-gray-700">JediRe, Inc.</p>
              <p className="text-gray-700">548 Market St, Suite 12345</p>
              <p className="text-gray-700">San Francisco, CA 94104</p>
              <p className="text-gray-700 mt-2">
                <strong>Email:</strong> dmca@jedire.com
              </p>
            </div>

            <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">Counter-Notification</h2>
            <p className="text-gray-600 mb-4">
              If you believe your content was removed in error, you may submit a counter-notification 
              containing the following:
            </p>
            <ol className="list-decimal list-inside text-gray-600 mb-6 space-y-2">
              <li>Your physical or electronic signature</li>
              <li>Identification of the material that has been removed or disabled</li>
              <li>A statement under penalty of perjury that you have a good faith belief the material was removed by mistake</li>
              <li>Your name, address, telephone number, and email address</li>
              <li>A statement that you consent to the jurisdiction of federal court</li>
            </ol>

            <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">Repeat Infringers</h2>
            <p className="text-gray-600">
              It is our policy to terminate the accounts of repeat infringers in appropriate circumstances.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
