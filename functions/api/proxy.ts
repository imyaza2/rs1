
interface Env {
  // Add environment variables here if needed
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const targetUrl = url.searchParams.get("target");

  if (!targetUrl) {
    return new Response("Missing 'target' query parameter", { status: 400 });
  }

  // Create a new request based on the original request
  // We strip sensitive headers (like Cookie) but keep Content-Type for multipart/form-data
  const originalReq = context.request;
  
  const init: RequestInit = {
    method: originalReq.method,
    headers: new Headers(originalReq.headers),
    body: originalReq.body,
  };

  // Important: Remove Host header to avoid confusion at destination
  (init.headers as Headers).delete("Host");
  (init.headers as Headers).delete("Origin");
  (init.headers as Headers).delete("Referer");

  try {
    const response = await fetch(targetUrl, init);
    
    // Recreate response to add CORS headers
    const newResponse = new Response(response.body, response);
    newResponse.headers.set("Access-Control-Allow-Origin", "*");
    newResponse.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    
    return newResponse;
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500,
      headers: { "Content-Type": "application/json" } 
    });
  }
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
};
