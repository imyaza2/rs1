
import React, { useState, useEffect, useRef } from "react";
import { getKV, setKV } from "./api";

/**
 * A hook that syncs state with LocalStorage (synchronously) and Cloudflare KV (asynchronously).
 * It provides instant UI updates while ensuring data persistence in the cloud.
 */
export function usePersistedState<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  // 1. Initialize from LocalStorage for immediate render
  const [state, setState] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const isFirstMount = useRef(true);

  // 2. On mount, try to fetch the latest data from Cloudflare KV
  useEffect(() => {
    let isMounted = true;
    const fetchCloudData = async () => {
      const cloudData = await getKV(key);
      if (isMounted && cloudData !== null && cloudData !== undefined) {
        // Update state if cloud data exists and is different (deep check omitted for simplicity)
        setState(cloudData);
        // Also update local storage to keep them in sync
        localStorage.setItem(key, JSON.stringify(cloudData));
      }
    };
    
    fetchCloudData();
    return () => { isMounted = false; };
  }, [key]);

  // 3. When state changes, save to LocalStorage (sync) and KV (async)
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    // Local Persistence
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.error("LocalStorage Save Error:", error);
    }

    // Cloud Persistence (Debounced slightly could be better, but direct for now)
    const timeoutId = setTimeout(() => {
      setKV(key, state);
    }, 1000); // 1 second debounce to avoid hitting KV write limits too hard

    return () => clearTimeout(timeoutId);
  }, [key, state]);

  return [state, setState];
}
