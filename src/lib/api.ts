
/**
 * Sends a request via the Cloudflare Pages Function proxy.
 */
export async function proxyFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const response = await fetch('/api/proxy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      method: options.method || 'GET',
      headers: options.headers || {},
      body: options.body instanceof FormData ? undefined : options.body, 
    }),
  });

  return response;
}

export async function sendViaProxy(baseUrl: string, endpoint: string, formData: FormData): Promise<Response> {
    const targetUrl = `${baseUrl}/${endpoint}`;
    const proxyUrl = `/api/proxy?target=${encodeURIComponent(targetUrl)}`;
    
    const response = await fetch(proxyUrl, {
        method: 'POST',
        body: formData,
    });
    
    if (!response.ok) {
        throw new Error(`Proxy Error: ${response.status} ${response.statusText}`);
    }
    
    return response;
}

// --- KV Database Methods ---

export async function getKV(key: string): Promise<any> {
  try {
    const res = await fetch(`/api/kv?key=${encodeURIComponent(key)}`);
    // If API endpoint doesn't exist (e.g. static host without functions) or fails
    if (!res.ok) {
        if(res.status !== 404) console.warn(`KV Fetch failed: ${res.status}`);
        return null;
    }
    
    // Check content type before parsing JSON
    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
        // This happens if Cloudflare returns a text/html error page
        return null;
    }

    const data = await res.json();
    return data.value;
  } catch (e) {
    console.error("KV Read Error:", e);
    return null;
  }
}

export async function setKV(key: string, value: any): Promise<void> {
  try {
    const res = await fetch('/api/kv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value })
    });
    
    if (!res.ok) {
        console.warn("KV Write failed", res.status);
    }
  } catch (e) {
    console.error("KV Write Error:", e);
  }
}
