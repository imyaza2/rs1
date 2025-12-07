
// Polyfill for KVNamespace and PagesFunction
interface KVNamespace {
  get(key: string, options?: { type?: "text" | "json" | "arrayBuffer" | "stream"; cacheTtl?: number }): Promise<any>;
  put(key: string, value: string | ReadableStream | ArrayBuffer | FormData, options?: { expiration?: number; expirationTtl?: number; metadata?: any }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{ keys: { name: string; expiration?: number; metadata?: any }[]; list_complete: boolean; cursor?: string }>;
}

type PagesFunction<Env = unknown, P extends string = string, Data = unknown> = (
  context: EventContext<Env, P, Data>
) => Response | Promise<Response>;

interface EventContext<Env, P extends string, Data> {
  request: Request;
  functionPath: string;
  waitUntil: (promise: Promise<any>) => void;
  passThroughOnException: () => void;
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
  env: Env;
  params: Record<P, string | string[]>;
  data: Data;
}

interface Env {
  DB: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const key = url.searchParams.get("key");

  if (!key) return new Response("Key required", { status: 400 });

  // Critical Check: Ensure KV binding exists
  if (!context.env.DB) {
      console.error("KV Binding 'DB' is missing.");
      return new Response(JSON.stringify({ 
          error: "KV Binding 'DB' not found. Please go to Cloudflare Dashboard > Pages > Settings > Functions and bind a KV Namespace to variable 'DB'." 
      }), { 
          status: 500,
          headers: { "Content-Type": "application/json" } 
      });
  }

  try {
    const value = await context.env.DB.get(key);
    return new Response(JSON.stringify({ value: value ? JSON.parse(value) : null }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    // Critical Check: Ensure KV binding exists
    if (!context.env.DB) {
        return new Response(JSON.stringify({ 
            error: "KV Binding 'DB' not found. Please check Cloudflare Pages Settings." 
        }), { 
            status: 500,
            headers: { "Content-Type": "application/json" } 
        });
    }

    const { key, value } = await context.request.json() as { key: string, value: any };
    
    if (!key) return new Response("Key required", { status: 400 });

    // Save to KV
    await context.env.DB.put(key, JSON.stringify(value));

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
