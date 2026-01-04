import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { AppErrorBoundary } from "@/components/ErrorBoundary";
import { GameProvider } from "@/contexts/game-context";

try {
  if (!(React as any).use) {
    (React as any).use = function <T>(promise: Promise<T> | T): T {
      if (promise && typeof (promise as any).then === 'function') {
        throw promise;
      }
      return promise as T;
    };
  }
} catch (e) {
  console.warn('Failed to polyfill React.use', e);
}


function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="game" options={{ headerShown: false }} />
      <Stack.Screen name="room/[code]" options={{ headerShown: false }} />
      <Stack.Screen name="debug" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        console.log('[RootLayout] Initializing app...');
        console.log('[RootLayout] Platform:', Platform.OS);
        
        if (Platform.OS !== 'web') {
          try {
            await SplashScreen.preventAutoHideAsync();
          } catch (error) {
            console.warn("SplashScreen.preventAutoHideAsync failed", error);
          }
        }

        setIsReady(true);
        console.log('[RootLayout] App ready');

        if (Platform.OS !== 'web') {
          try {
            await SplashScreen.hideAsync();
          } catch (error) {
            console.warn("SplashScreen.hideAsync failed", error);
          }
        }
      } catch (error: any) {
        console.error('[RootLayout] Initialization error:', error);
        setInitError(error?.message || 'Failed to initialize app');
        setIsReady(true);
      }
    };

    void run();
  }, []);

  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (initError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Failed to load</Text>
        <Text style={styles.errorMessage}>{initError}</Text>
      </View>
    );
  }

  return (
    <AppErrorBoundary>
      <GameProvider>
        <RootLayoutNav />
      </GameProvider>
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a2e',
  },
  loadingText: {
    color: '#ffd369',
    fontSize: 18,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a2e',
    padding: 20,
  },
  errorTitle: {
    color: '#ff6b6b',
    fontSize: 20,
    fontWeight: '700' as const,
    marginBottom: 10,
  },
  errorMessage: {
    color: '#c0c4d6',
    fontSize: 14,
    textAlign: 'center' as const,
  },
});
