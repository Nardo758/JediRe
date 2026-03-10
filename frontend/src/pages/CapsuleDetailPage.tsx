import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const CapsuleDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      navigate(`/deals/${id}/detail?tab=collision-analysis`, { replace: true });
    } else {
      navigate('/deals', { replace: true });
    }
  }, [id, navigate]);

  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-stone-500">Redirecting to Collision Analysis...</div>
    </div>
  );
};

export default CapsuleDetailPage;
