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

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
    }),
  ],
});
