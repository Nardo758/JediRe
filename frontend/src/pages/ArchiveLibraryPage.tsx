import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { BT } from '../components/deal/bloomberg-ui';

export function ArchiveLibraryPage() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  params.set('tab', 'files');
  return <Navigate to={`/settings/data-library?${params.toString()}`} replace />;
}
