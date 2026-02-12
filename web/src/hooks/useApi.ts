import { useState, useCallback } from 'react';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
}

interface UseApiReturn {
  loading: boolean;
  error: string | null;
  execute: <T>(url: string, options?: RequestInit) => Promise<ApiResponse<T>>;
}

export function useApi(): UseApiReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async <T,>(url: string, options: RequestInit = {}): Promise<ApiResponse<T>> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
      const data = await response.json();
      
      if (!response.ok) {
        setError(`请求返回错误 (${response.status})`);
      }
      
      return { 
        success: response.ok, 
        data, 
        status: response.status 
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '网络请求失败';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, execute };
}
