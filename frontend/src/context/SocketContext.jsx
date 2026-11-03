/**
 * Socket.IO Context & Connection Engine for Khushboo Grocery Service.
 *
 * Provides a single, centralized Socket.IO client connection authenticated
 * with the active user's JWT credentials. Automatically handles connection
 * lifecycle, server reconnects with exponential backoff, and room events.
 *
 * @module context/SocketContext
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext.jsx';
import { API_BASE_URL } from '../config/api.js';

const SocketContext = createContext({
  socket: null,
  isConnected: false,
});

/**
 * Resolves the Socket.IO server URL based on the API base URL.
 */
function getSocketUrl() {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }
  // Strip trailing /api or /api/v1 from API_BASE_URL
  const clean = API_BASE_URL.replace(/\/api(\/v\d+)?\/?$/, '');
  if (clean) return clean;
  if (import.meta.env.PROD && typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://localhost:5000';
}

export function SocketProvider({ children }) {
  const { user, token, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  // Use reactive state for the socket instance so consumers re-render when it
  // becomes available after the async connect handshake.
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Only connect if the user is authenticated with a valid token
    if (!isAuthenticated || !token) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    const socketUrl = getSocketUrl();
    const newSocket = io(socketUrl, {
      withCredentials: true,
      auth: {
        token: `Bearer ${token}`,
      },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    // Store socket instance in state so NotificationContext re-renders and
    // attaches its socket.on listeners as soon as the socket is ready.
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
    });

    newSocket.on('notification:connected', (_data) => {
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.warn('[socket] Connection error:', err.message);
      setIsConnected(false);
    });

    return () => {
      newSocket.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [isAuthenticated, token, user?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}

