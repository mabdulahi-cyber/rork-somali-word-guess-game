import React, { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useGame } from '@/contexts/game-context';
import GameScreen from '../game';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

export default function RoomCodeScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { roomCode, setRoomCode, isInitializing } = useGame();
  const router = useRouter();

  useEffect(() => {
    if (code && typeof code === 'string') {
        const upperCode = code.toUpperCase();
        if (roomCode !== upperCode) {
            console.log("[RoomCodeScreen] Setting room code from URL:", upperCode);
            setRoomCode(upperCode);
        }
    }
  }, [code, roomCode, setRoomCode]);

  // If initialization is done and we have no code, redirect
  useEffect(() => {
    if (!isInitializing && !code && !roomCode) {
        router.replace('/');
    }
  }, [isInitializing, code, roomCode, router]);

  if (isInitializing) {
    return (
        <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ffd369" />
            <Text style={styles.loadingText}>Loading room...</Text>
        </View>
    );
  }

  return <GameScreen />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#ffffff',
    fontSize: 16,
  },
});
