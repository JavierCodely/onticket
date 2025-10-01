
import { useState, useEffect, useCallback } from 'react';

interface AsyncState<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
}

export const useAsync = <T>(
  asyncFunction: () => Promise<T>,
  dependencies: any[] = []
) => {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    isLoading: true,
    error: null,
  });

  const execute = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const data = await asyncFunction();
      setState({ data, isLoading: false, error: null });
      return data;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      setState({ data: null, isLoading: false, error: errorObj });
      throw errorObj;
    }
  }, dependencies);

  useEffect(() => {
    execute();
  }, dependencies);

  return {
    ...state,
    execute,
    reset: () => setState({ data: null, isLoading: true, error: null }),
  };
};
