import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';
import axios from 'axios';

type ConnectionStatus = 'checking' | 'online' | 'offline';

interface ConnectionMonitorProps {
  onStatusChange?: (online: boolean) => void;
}

export default function ConnectionMonitor({ onStatusChange }: ConnectionMonitorProps) {
  const [status, setStatus] = useState<ConnectionStatus>('checking');

  const checkConnection = useCallback(async (showChecking = false) => {
    if (showChecking) setStatus('checking');

    try {
      await axios.get('/api/dashboard', { timeout: 5000 });
      setStatus('online');
    } catch {
      setStatus('offline');
    }
  }, []);

  useEffect(() => {
    checkConnection(true);

    const interval = window.setInterval(() => checkConnection(), 30000);
    return () => window.clearInterval(interval);
  }, [checkConnection]);

  useEffect(() => {
    if (status === 'online') onStatusChange?.(true);
    if (status === 'offline') onStatusChange?.(false);
  }, [status, onStatusChange]);

  const isChecking = status === 'checking';
  const isOnline = status === 'online';

  return (
    <div className="inline-flex" role="status" aria-live="polite">
      <button
        type="button"
        onClick={() => checkConnection(true)}
        title="Clique para verificar a conexão novamente"
        aria-label="Verificar conexão com a API"
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
          isChecking
            ? 'bg-card border-line text-muted'
            : isOnline
              ? 'bg-successSoft border-success text-success'
              : 'bg-dangerSoft border-danger text-danger'
        }`}
      >
        {isChecking ? (
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        ) : isOnline ? (
          <Wifi className="h-3.5 w-3.5" />
        ) : (
          <WifiOff className="h-3.5 w-3.5" />
        )}
        {isChecking ? 'Verificando...' : isOnline ? 'API online' : 'API offline'}
      </button>
    </div>
  );
}
