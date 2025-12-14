import React, { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AppErrorBoundary } from "@/components/ErrorBoundary";
import { GameProvider } from "@/contexts/game-context";
import { trpc, trpcClient } from "@/lib/trpc";

const reactAny = React as unknown as { use?: (usable: unknown) => unknown };
if (typeof reactAny.use !== "function") {
  reactAny.use = (usable: unknown) => {
    const maybeThen = usable as { then?: (onFulfilled?: unknown, onRejected?: unknown) => unknown };

    if (maybeThen && typeof maybeThen.then === "function") {
      throw usable;
    }

    return usable;
  };
  console.warn("React.use() shim installed for React 18 compatibility.");
}

// Avoid calling async SplashScreen APIs during module evaluation to prevent setState-on-unmounted warnings in dev overlays.
// Expo will keep the splash visible until hideAsync is called.


const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="game" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    const run = async () => {
      try {
        await SplashScreen.preventAutoHideAsync();
      } catch (error) {
        console.warn("SplashScreen.preventAutoHideAsync failed", error);
      }

      try {
        await SplashScreen.hideAsync();
      } catch (error) {
        console.warn("SplashScreen.hideAsync failed", error);
      }
    };

    void run();
  }, []);

  return (
    <AppErrorBoundary>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <GameProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <RootLayoutNav />
            </GestureHandlerRootView>
          </GameProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </AppErrorBoundary>
  );
}
