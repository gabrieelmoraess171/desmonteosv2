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
      // O Render pode levar alguns segundos para acordar o serviço.
      // Use o endpoint leve de saúde para não carregar o dashboard só para testar a API.
      await axios.get('/api/health', { timeout: 30000 });
      setStatus('online');
    } catch {
      setStatus('offline');
    }
  }, []);

  useEffect(() => {
    checkConnection(true);

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void checkConnection();
    }, 60000);
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
        className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
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
          <Wifi className="h-4 w-4" />
        ) : (
          <WifiOff className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
