import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Sparkles, Users, Shield, Mic, MicOff, Copy, ArrowLeft } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useGame } from '@/contexts/game-context';
import type { Team } from '@/types/game';

type FlowState = 'initial' | 'create' | 'join' | 'lobby';

export default function LobbyScreen() {
  const router = useRouter();
  const {
    createRoom,
    joinRoom,
    roomCode,
    roomState,
    selectTeam,
    setRole,
    currentPlayer,
    isRoomLoading,
  } = useGame();

  const [flowState, setFlowState] = useState<FlowState>('initial');
  const [playerName, setPlayerName] = useState<string>('');
  const [joinCode, setJoinCode] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleCreateGame = async () => {
    try {
      setIsSubmitting(true);
      setErrorMessage('');
      console.log('[LobbyScreen] Creating room for player:', playerName);
      await createRoom(playerName);
      console.log('[LobbyScreen] Room created successfully');
      setFlowState('lobby');
    } catch (error: any) {
      console.error('[LobbyScreen] Create room failed:', error);
      const errorMsg = error?.message || (typeof error === 'string' ? error : 'Unable to create room. Check console for details.');
      setErrorMessage(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinGame = async () => {
    try {
      setIsSubmitting(true);
      setErrorMessage('');
      console.log('[LobbyScreen] Joining room:', joinCode);
      await joinRoom(playerName, joinCode);
      console.log('[LobbyScreen] Room joined successfully');
      setFlowState('lobby');
    } catch (error: any) {
      console.error('[LobbyScreen] Join room failed:', error);
      const errorMsg = error?.message || (typeof error === 'string' ? error : 'Unable to join room. Check console for details.');
      setErrorMessage(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyRoomCode = async () => {
    if (roomCode) {
      await Clipboard.setStringAsync(roomCode);
      if (Platform.OS === 'web') {
        Alert.alert('Copied!', `Room code ${roomCode} copied to clipboard`);
      }
    }
  };

  const handleBack = () => {
    setFlowState('initial');
    setPlayerName('');
    setJoinCode('');
    setErrorMessage('');
  };

  const normalizeUiError = (error: unknown, fallback: string): string => {
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object') {
      const anyErr = error as any;
      const message =
        (typeof anyErr?.message === 'string' && anyErr.message) ||
        (typeof anyErr?.toString === 'function' ? String(anyErr.toString()) : fallback);
      const code = typeof anyErr?.code === 'string' ? anyErr.code : '';
      const details = typeof anyErr?.details === 'string' ? anyErr.details : '';
      const hint = typeof anyErr?.hint === 'string' ? anyErr.hint : '';

      let out = message;
      if (code) out += ` (${code})`;
      if (details) out += ` - ${details}`;
      if (hint) out += ` Hint: ${hint}`;
      return out;
    }
    return fallback;
  };

  const handleTeamSelect = async (team: Team) => {
    try {
      await selectTeam(team);
      await setRole('guesser');
    } catch (error) {
      setErrorMessage(normalizeUiError(error, 'Unable to select team'));
    }
  };

  const handleSetScrumMaster = async () => {
    try {
      await setRole('spymaster');
    } catch (error) {
      setErrorMessage(normalizeUiError(error, 'Unable to set role'));
    }
  };

  const handleSetGuesser = async () => {
    try {
      await setRole('guesser');
    } catch (error) {
      setErrorMessage(normalizeUiError(error, 'Unable to set role'));
    }
  };

  const canEnterGame = useMemo(() => {
    if (!roomState || !currentPlayer) return false;
    const hasName = Boolean(currentPlayer.name?.trim());
    const hasTeam = Boolean(currentPlayer.team);
    return hasName && hasTeam;
  }, [currentPlayer, roomState]);

  const handleEnterGame = () => {
    if (!canEnterGame) return;
    if (roomCode) {
        router.push({ pathname: '/room/[code]', params: { code: roomCode } });
    }
  };

  const renderPlayerList = () => {
    if (!roomState) {
      return null;
    }

    return (
      <View style={styles.playerListContainer}>
        <View style={styles.playerListHeader}>
          <Users size={18} color="#ffd369" />
          <Text style={styles.playerListTitle}>Players</Text>
        </View>
        {roomState.players.length === 0 ? (
          <Text style={styles.emptyStateText}>No players yet.</Text>
        ) : (
          roomState.players.map((player) => (
            <View
              key={player.id}
              style={[
                styles.playerRow,
                player.role === 'spymaster' && styles.playerRowSpymaster,
              ]}
            >
              <View
                style={[
                  styles.playerTeamDot,
                  {
                    backgroundColor:
                      player.team === 'red'
                        ? '#ff6b6b'
                        : player.team === 'blue'
                        ? '#4ecdc4'
                        : 'rgba(255, 255, 255, 0.25)',
                  },
                ]}
              />
              <Text style={styles.playerNameText}>{player.name}</Text>
              {player.role === 'spymaster' && (
                <View style={styles.playerBadge}>
                  <Shield size={14} color="#16213e" />
                  <Text style={styles.playerBadgeText}>Spymaster</Text>
                </View>
              )}
              {player.micMuted ? (
                <MicOff size={18} color="#ff6b6b" />
              ) : (
                <Mic size={18} color="#4ecdc4" />
              )}
            </View>
          ))
        )}
      </View>
    );
  };

  const renderInitialScreen = () => (
    <View style={styles.content}>
      <View style={styles.headerContainer}>
        <Sparkles size={48} color="#ffd369" strokeWidth={2} />
        <Text style={styles.title}>Somali Lobby</Text>
        <Text style={styles.subtitle}>Create or join a real-time match</Text>
      </View>

      <View style={styles.initialButtonContainer}>
        <Pressable
          testID="create-game-button"
          style={({ pressed }) => [
            styles.largeButton,
            styles.primaryButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => setFlowState('create')}
        >
          <Text style={[styles.largeButtonText, styles.buttonTextDark]}>Create Game</Text>
        </Pressable>
        <Pressable
          testID="join-game-button"
          style={({ pressed }) => [
            styles.largeButton,
            styles.secondaryButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => setFlowState('join')}
        >
          <Text style={styles.largeButtonText}>Join Game</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderCreateFlow = () => (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Pressable onPress={handleBack} style={styles.backButton}>
        <ArrowLeft size={24} color="#ffd369" />
        <Text style={styles.backButtonText}>Back</Text>
      </Pressable>

      <View style={styles.headerContainer}>
        <Sparkles size={48} color="#ffd369" strokeWidth={2} />
        <Text style={styles.title}>Create Game</Text>
        <Text style={styles.subtitle}>Set up a new room for your team</Text>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.cardTitle}>Player Name</Text>
        <TextInput
          testID="player-name-input"
          style={styles.input}
          placeholder="Enter your player name"
          placeholderTextColor="#8087a2"
          value={playerName}
          onChangeText={setPlayerName}
          autoFocus
        />

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <Pressable
          testID="submit-create-button"
          style={({ pressed }) => [
            styles.largeButton,
            styles.primaryButton,
            pressed && styles.buttonPressed,
            (isSubmitting || !playerName.trim()) && styles.buttonDisabled,
          ]}
          onPress={handleCreateGame}
          disabled={isSubmitting || !playerName.trim()}
        >
          <Text style={[styles.largeButtonText, styles.buttonTextDark]}>
            {isSubmitting ? 'Creating...' : 'Create Room'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );

  const renderJoinFlow = () => (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Pressable onPress={handleBack} style={styles.backButton}>
        <ArrowLeft size={24} color="#ffd369" />
        <Text style={styles.backButtonText}>Back</Text>
      </Pressable>

      <View style={styles.headerContainer}>
        <Sparkles size={48} color="#ffd369" strokeWidth={2} />
        <Text style={styles.title}>Join Game</Text>
        <Text style={styles.subtitle}>Enter room code to join</Text>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.cardTitle}>Player Name</Text>
        <TextInput
          testID="player-name-input"
          style={styles.input}
          placeholder="Enter your player name"
          placeholderTextColor="#8087a2"
          value={playerName}
          onChangeText={setPlayerName}
          autoFocus
        />

        <Text style={styles.cardTitle}>Room Code</Text>
        <TextInput
          testID="room-code-input"
          style={styles.input}
          placeholder="Enter room code"
          placeholderTextColor="#8087a2"
          autoCapitalize="characters"
          value={joinCode}
          onChangeText={setJoinCode}
        />

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <Pressable
          testID="submit-join-button"
          style={({ pressed }) => [
            styles.largeButton,
            styles.primaryButton,
            pressed && styles.buttonPressed,
            (isSubmitting || !playerName.trim() || !joinCode.trim()) && styles.buttonDisabled,
          ]}
          onPress={handleJoinGame}
          disabled={isSubmitting || !playerName.trim() || !joinCode.trim()}
        >
          <Text style={[styles.largeButtonText, styles.buttonTextDark]}>
            {isSubmitting ? 'Joining...' : 'Join Room'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );

  const renderLobbyScreen = () => (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.headerContainer}>
        <Sparkles size={48} color="#ffd369" strokeWidth={2} />
        <Text style={styles.title}>Game Lobby</Text>
        <Text style={styles.subtitle}>Prepare your team</Text>
      </View>

      {roomCode ? (
        <View style={styles.formCard}>
          <Text style={styles.cardTitle}>Room Code</Text>
          <View style={styles.roomCodeContainer}>
            <Text style={styles.roomCodeText}>{roomCode}</Text>
            <Pressable
              testID="copy-room-code-button"
              style={({ pressed }) => [
                styles.copyButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleCopyRoomCode}
            >
              <Copy size={20} color="#16213e" />
              <Text style={styles.copyButtonText}>Copy Code</Text>
            </Pressable>
          </View>
          <Text style={styles.roomCodeHint}>Share this code with your team</Text>
        </View>
      ) : null}

      {roomState ? (
        <View style={styles.formCard}>
          <Text style={styles.cardTitle}>Prepare Your Team</Text>
          <Text style={styles.cardDescription}>Choose your team (role optional).</Text>

          <View style={styles.teamRow}>
            <Pressable
              testID="select-team-red"
              onPress={() => handleTeamSelect('red')}
              style={[styles.teamButton, currentPlayer?.team === 'red' && styles.teamButtonActiveRed]}
            >
              <Text style={styles.teamText}>Join Red Team</Text>
            </Pressable>
            <Pressable
              testID="select-team-blue"
              onPress={() => handleTeamSelect('blue')}
              style={[styles.teamButton, currentPlayer?.team === 'blue' && styles.teamButtonActiveBlue]}
            >
              <Text style={styles.teamText}>Join Blue Team</Text>
            </Pressable>
          </View>

          <View style={styles.roleRow}>
            <Pressable
              testID="become-spymaster-button"
              onPress={handleSetScrumMaster}
              style={[styles.roleButton, currentPlayer?.role === 'spymaster' && styles.roleButtonActive]}
            >
              <Text style={styles.roleText}>
                {currentPlayer?.role === 'spymaster' ? 'You are Spymaster' : 'Become Spymaster'}
              </Text>
            </Pressable>
            <Pressable
              testID="become-guesser-button"
              onPress={handleSetGuesser}
              style={[styles.roleButton, currentPlayer?.role === 'guesser' && styles.roleButtonActive]}
            >
              <Text style={styles.roleText}>Play as Guesser</Text>
            </Pressable>
          </View>

          <Pressable
            testID="enter-game-button"
            style={({ pressed }) => [
              styles.enterGameButton,
              pressed && canEnterGame && styles.buttonPressed,
              (!canEnterGame || isRoomLoading) && styles.buttonDisabled,
            ]}
            disabled={!canEnterGame || isRoomLoading}
            onPress={handleEnterGame}
          >
            <Text style={styles.enterGameText}>Enter Game</Text>
          </Pressable>

          {!canEnterGame ? (
            <Text style={styles.errorText}>
              {!currentPlayer?.name?.trim()
                ? 'Enter your name to continue'
                : !currentPlayer?.team
                ? 'Pick a team to continue'
                : ''}
            </Text>
          ) : null}

          {renderPlayerList()}
        </View>
      ) : null}
    </ScrollView>
  );

  return (
    <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {flowState === 'initial' && renderInitialScreen()}
        {flowState === 'create' && renderCreateFlow()}
        {flowState === 'join' && renderJoinFlow()}
        {flowState === 'lobby' && renderLobbyScreen()}
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
    flexGrow: 1,
  },
  initialButtonContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 12,
  },
  largeButton: {
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  largeButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffd369',
  },
  roomCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 211, 105, 0.08)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 211, 105, 0.3)',
    marginBottom: 12,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffd369',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  copyButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#16213e',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 42,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 16,
    letterSpacing: 1.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#c0c4d6',
  },
  formCard: {
    backgroundColor: 'rgba(15, 30, 60, 0.85)',
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 211, 105, 0.15)',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffd369',
    marginBottom: 12,
  },
  cardDescription: {
    fontSize: 14,
    color: '#c0c4d6',
    marginBottom: 20,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 13,
    marginBottom: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#ffd369',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  buttonTextDark: {
    color: '#16213e',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  roomCodeText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 3,
  },
  roomCodeHint: {
    fontSize: 12,
    color: '#c0c4d6',
    marginTop: 6,
  },
  teamRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  teamButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  teamButtonActiveRed: {
    backgroundColor: 'rgba(255, 107, 107, 0.25)',
    borderColor: '#ff6b6b',
  },
  teamButtonActiveBlue: {
    backgroundColor: 'rgba(78, 205, 196, 0.25)',
    borderColor: '#4ecdc4',
  },
  teamText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  roleRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  roleButtonActive: {
    backgroundColor: 'rgba(255, 211, 105, 0.25)',
    borderColor: '#ffd369',
  },
  roleText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  enterGameButton: {
    marginBottom: 16,
    backgroundColor: '#ffd369',
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
  },
  enterGameText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#16213e',
  },
  playerListContainer: {
    marginTop: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 18,
    padding: 16,
  },
  playerListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  playerListTitle: {
    fontSize: 14,
    color: '#ffd369',
    fontWeight: '600',
    letterSpacing: 1,
  },
  emptyStateText: {
    color: '#c0c4d6',
    fontStyle: 'italic',
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  playerRowSpymaster: {
    backgroundColor: 'rgba(255, 211, 105, 0.15)',
    borderRadius: 14,
    padding: 10,
  },
  playerTeamDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  playerNameText: {
    color: '#ffffff',
    fontWeight: '600',
    flex: 1,
  },
  playerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffd369',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  playerBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16213e',
  },
});
