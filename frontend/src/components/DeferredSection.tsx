import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';

// Blocos fora da tela só carregam código e dados quando o usuário se aproxima.
export default function DeferredSection({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: '250px' });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const fallback = <div className="rounded-2xl border border-line bg-card p-6 text-sm text-muted" role="status">Carregando estoque…</div>;
  return <div ref={ref} style={{ minHeight: visible ? undefined : 160 }}>
    {visible ? <Suspense fallback={fallback}>{children}</Suspense> : <div className="rounded-2xl border border-line p-6 text-sm text-muted">As peças do estoque aparecem aqui.</div>}
  </div>;
}
