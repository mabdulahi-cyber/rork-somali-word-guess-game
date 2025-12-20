import React, { useEffect, useState } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AppErrorBoundary } from "@/components/ErrorBoundary";
import { GameProvider } from "@/contexts/game-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

if (!(React as any).use) {
  (React as any).use = function <T>(promise: Promise<T> | T): T {
    if (promise && typeof (promise as any).then === 'function') {
      throw promise;
    }
    return promise as T;
  };
}

// Avoid calling async SplashScreen APIs during module evaluation to prevent setState-on-unmounted warnings in dev overlays.
// Expo will keep the splash visible until hideAsync is called.


function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="game" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  }));

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
      <QueryClientProvider client={queryClient}>
        <GameProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <RootLayoutNav />
          </GestureHandlerRootView>
        </GameProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}
