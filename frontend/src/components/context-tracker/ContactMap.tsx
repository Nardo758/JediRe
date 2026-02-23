/**
 * Contact Map Tab - Context Tracker
 * Visual network of stakeholders and relationships
 */

import React from 'react';
import { PlaceholderContent } from '../deal/PlaceholderContent';

export const ContactMap: React.FC = () => {
  return (
    <PlaceholderContent
      title="Contact Map"
      description="Visual network of all stakeholders, contacts, and relationships"
      status="to-be-built"
      icon="👥"
    >
      <div className="text-sm text-gray-600">
        Will display: Interactive network graph showing relationships between team members, investors, brokers, vendors, etc.
      </div>
    </PlaceholderContent>
  );
};

export default ContactMap;
