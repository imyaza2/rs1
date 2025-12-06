
/**
 * Sends a request via the Cloudflare Pages Function proxy.
 * This avoids CORS issues and hides the client IP from the target API.
 */
export async function proxyFetch(url: string, options: RequestInit = {}): Promise<Response> {
  // In development (Vite), we might need to point to the functions emulator if running,
  // but usually relative path '/api/proxy' works if deployed or configured.
  // We send the target URL and options in the body to our own backend function.
  
  const response = await fetch('/api/proxy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      method: options.method || 'GET',
      headers: options.headers || {},
      body: options.body instanceof FormData ? undefined : options.body, // Simple proxy limitation: FormData needs special handling, here assuming JSON/Text for simplicity or specific FormData handling in proxy
      // For FormData support, we usually need to serialize it or send it as is. 
      // For this implementation, we will handle the FormData construction inside the Proxy Function or client side serialization.
      // To keep it robust for "sendMediaGroup", we will handle serialization manually.
    }),
  });

  return response;
}

/**
 * Specifically handles multipart/form-data for sending files via the proxy.
 * Since we can't easily pass FormData object through JSON, we'll implement the logic 
 * slightly differently: The proxy will just forward the request.
 */
export async function sendViaProxy(baseUrl: string, endpoint: string, formData: FormData): Promise<Response> {
    // Note: Sending actual FormData through a JSON-based proxy is complex. 
    // A better approach for Cloudflare Pages is to have the client construct the request
    // and the Function acts as a transparent reverse proxy.
    
    // HOWEVER, to support file uploads from client -> function -> telegram, 
    // we need to be careful with body parsing.
    
    // SIMPLIFIED APPROACH:
    // We will call the Telegram API directly via a "Transparent Proxy".
    // The '/api/proxy' endpoint will receive the `url` query param.
    
    const targetUrl = `${baseUrl}/${endpoint}`;
    
    // We append the target URL to the query string
    const proxyUrl = `/api/proxy?target=${encodeURIComponent(targetUrl)}`;
    
    const response = await fetch(proxyUrl, {
        method: 'POST',
        body: formData, // Browser handles Content-Type: multipart/form-data boundary automatically
    });
    
    if (!response.ok) {
        throw new Error(`Proxy Error: ${response.status} ${response.statusText}`);
    }
    
    return response;
}
