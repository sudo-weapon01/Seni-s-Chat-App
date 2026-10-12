'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { getStoredToken } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

const SocketContext = createContext(null);
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';

export function SocketProvider({ children }) {
  const { user, ready } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [presence, setPresence] = useState({});
  const instanceRef = useRef(null);

  useEffect(() => {
    if (!ready || !user) {
      if (instanceRef.current) {
        instanceRef.current.disconnect();
        instanceRef.current = null;
        setSocket(null);
        setConnected(false);
      }
      return undefined;
    }

    const instance = io(WS_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      auth: { token: getStoredToken() },
    });
    instanceRef.current = instance;
    setSocket(instance);

    instance.on('connect', () => setConnected(true));
    instance.on('disconnect', () => setConnected(false));
    instance.on('presence:update', ({ userId, online }) => {
      setPresence((prev) => ({ ...prev, [userId]: online }));
    });

    return () => {
      instance.disconnect();
      instanceRef.current = null;
      setSocket(null);
      setConnected(false);
    };
  }, [ready, user]);

  const value = useMemo(
    () => ({ socket, connected, presence, setPresence }),
    [socket, connected, presence]
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
}
