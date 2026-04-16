import { useEffect } from 'react';

export default function F4CommentarySpecPage() {
  useEffect(() => {
    document.title = 'F4 Commentary Spec — JEDI RE';
  }, []);

  return (
    <iframe
      src="/docs/f4-commentary-spec.html"
      style={{
        width: '100%',
        height: '100vh',
        border: 'none',
        display: 'block',
      }}
      title="F4 Markets Tab — Commentary Enhancement Specification"
    />
  );
}
