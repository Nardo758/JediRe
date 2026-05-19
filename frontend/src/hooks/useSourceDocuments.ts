import { useState, useEffect } from 'react';

export interface SourceDocument {
  file_id: string;
  filename: string;
  document_type: string;
  mime_type?: string | null;
  file_size_bytes?: number | null;
  extracted_at: string;
  key_fields: string[];
  rows_inserted?: number | null;
  source_ref?: string | null;
}

interface UseSourceDocumentsResult {
  documents: SourceDocument[];
  byDocType: Record<string, SourceDocument>;
  loading: boolean;
}

/**
 * Fetches GET /api/v1/deals/:dealId/source-documents once per deal.
 * Returns `byDocType` keyed by document_type (most recently extracted wins
 * when multiple files of the same type exist).
 */
export function useSourceDocuments(dealId: string | null | undefined): UseSourceDocumentsResult {
  const [documents, setDocuments] = useState<SourceDocument[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!dealId) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/v1/deals/${dealId}/source-documents`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then((data: { source_documents?: SourceDocument[] } | null) => {
        if (!cancelled) {
          setDocuments(data?.source_documents ?? []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [dealId]);

  const byDocType = documents.reduce<Record<string, SourceDocument>>((acc, doc) => {
    if (!acc[doc.document_type]) acc[doc.document_type] = doc;
    return acc;
  }, {});

  return { documents, byDocType, loading };
}
