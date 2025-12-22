import React, { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { AppErrorBoundary } from "@/components/ErrorBoundary";
import { GameProvider } from "@/contexts/game-context";

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
      <Stack.Screen name="room/[code]" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" options={{ headerShown: false }} />
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
      <GameProvider>
        <RootLayoutNav />
      </GameProvider>
    </AppErrorBoundary>
  );
}
