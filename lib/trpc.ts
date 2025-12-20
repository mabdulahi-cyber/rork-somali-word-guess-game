import { createTRPCReact } from "@trpc/react-query";
import { httpLink } from "@trpc/client";
import Constants from "expo-constants";
import type { AppRouter } from "@/backend/trpc/app-router";
import superjson from "superjson";

export const trpc = createTRPCReact<AppRouter>();

const FALLBACK_REMOTE_BASE_URL = "https://snoss5o422h7k71vznqo3.preview.rork.app" as const;

const resolveHostFromExpo = () => {
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  if (!hostUri) return null;

  const [host, port] = hostUri.split(":");
  if (!host) return null;

  return port ? `http://${host}:${port}` : `http://${host}`;
};

const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_RORK_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  const expoResolvedHost = resolveHostFromExpo();
  if (expoResolvedHost) {
    return expoResolvedHost;
  }

  console.warn(
    "Falling back to default remote API base URL. Set EXPO_PUBLIC_RORK_API_BASE_URL for explicit configuration."
  );
  return FALLBACK_REMOTE_BASE_URL;
};

const baseUrl = getBaseUrl();
const trpcUrl = `${baseUrl}/api/trpc`;

console.log('[tRPC] Initializing client with URL:', trpcUrl);

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: trpcUrl,
      transformer: superjson,
      async fetch(url, options) {
        console.log('[tRPC] Request to:', url);
        try {
          const response = await fetch(url, {
            ...options,
            headers: {
              ...options?.headers,
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            console.error('[tRPC] HTTP error:', response.status, response.statusText);
            
            let errorText = '';
            try {
              errorText = await response.text();
            } catch (readError) {
              console.error('[tRPC] Failed to read error response:', readError);
              throw new Error(`Server error ${response.status}: Unable to read response`);
            }

            if (errorText.includes('<!DOCTYPE') || errorText.includes('<html')) {
              console.error('[tRPC] Server returned HTML:', errorText.substring(0, 200));
              throw new Error('Backend endpoint misconfigured on Netlify. Check your API route.');
            }

            throw new Error(`Server error ${response.status}: ${errorText.substring(0, 200)}`);
          }

          return response;
        } catch (error) {
          if (error instanceof TypeError && error.message.includes('fetch')) {
            console.error('[tRPC] Network error:', error);
            throw new Error('Network error. Please check your connection.');
          }
          throw error;
        }
      },
    }),
  ],
});
