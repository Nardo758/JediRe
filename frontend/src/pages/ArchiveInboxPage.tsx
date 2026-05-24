import React from 'react';
import { Navigate } from 'react-router-dom';

export function ArchiveInboxPage() {
  return <Navigate to="/settings/data-library?tab=inbox" replace />;
}
