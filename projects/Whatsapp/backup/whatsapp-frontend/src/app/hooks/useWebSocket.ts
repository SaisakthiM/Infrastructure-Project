import { useEffect, useState, useCallback, useRef } from "react";
import { createWebSocketConnection } from "../services/api";

const MAX_RECONNECT_DELAY = 15000;
const HEARTBEAT_INTERVAL = 15000;

export const useWebSocket = (roomId: string | number | null, token: string | null) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const closedByUserRef = useRef(false);

  useEffect(() => {
    if (!roomId || !token) return;

    closedByUserRef.current = false;
    reconnectAttemptRef.current = 0;

    const connect = () => {
      const ws = createWebSocketConnection(roomId, token);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setError(null);
        reconnectAttemptRef.current = 0;
        heartbeatRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, HEARTBEAT_INTERVAL);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          setMessages((prev) => {
            if (prev.find((m) => m.id === message.id)) return prev;
            return [...prev, message];
          });
        } catch {}
      };

      ws.onerror = () => setError("Connection error");

      ws.onclose = () => {
        setIsConnected(false);
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
          heartbeatRef.current = null;
        }
        if (closedByUserRef.current) return;
        const attempt = ++reconnectAttemptRef.current;
        const delay = Math.min(1000 * 2 ** (attempt - 1), MAX_RECONNECT_DELAY);
        setError("Reconnecting...");
        reconnectTimerRef.current = setTimeout(() => {
          if (!closedByUserRef.current) connect();
        }, delay);
      };
    };

    connect();

    return () => {
      closedByUserRef.current = true;
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [roomId, token]);

  const sendMessage = useCallback((content: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(content);
    } else {
      setError("Connection not established");
    }
  }, []);

  const sendImage = useCallback((mediaUrl: string, caption = "") => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "image", media_url: mediaUrl, content: caption }));
    } else {
      setError("Connection not established");
    }
  }, []);

  return {
    messages,
    isConnected,
    error,
    sendMessage,
    sendImage,
    clearMessages: () => setMessages([]),
  };
};
