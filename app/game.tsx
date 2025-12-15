import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
  ScrollView,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Home, RotateCcw, Mic, MicOff, Send, Crown, ChevronsDown } from 'lucide-react-native';
import { useGame } from '@/contexts/game-context';
import type { Card, Hint, Player, Team } from '@/types/game';

const CARD_MARGIN = 6;
const CARDS_PER_ROW = 5;
const MAX_BOARD_WIDTH = 1000;

interface WordCardProps {
  card: Card;
  onPress: () => void;
  disabled: boolean;
  cardSize: number;
  isSpymaster: boolean;
}

function WordCard({ card, onPress, disabled, cardSize, isSpymaster }: WordCardProps) {
  const [scaleAnim] = useState(new Animated.Value(1));

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.94,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  const getCardColors = (): [string, string] => {
    if (card.revealed) {
      switch (card.type) {
        case 'red':
          return ['#ff6b6b', '#ee5a52'];
        case 'blue':
          return ['#4ecdc4', '#44a7a0'];
        case 'neutral':
          return ['#f4e4c1', '#e6d5a8'];
        case 'assassin':
          return ['#2d3436', '#1a1d1e'];
        default:
          return ['#e8e8e8', '#d0d0d0'];
      }
    }

    if (isSpymaster) {
      switch (card.type) {
        case 'red':
          return ['#ff6b6b', '#ee5a52'];
        case 'blue':
          return ['#4ecdc4', '#44a7a0'];
        case 'neutral':
          return ['#f4e4c1', '#e6d5a8'];
        case 'assassin':
          return ['#2d3436', '#1a1d1e'];
        default:
          return ['#e8e8e8', '#d0d0d0'];
      }
    }

    return ['#e8e8e8', '#d0d0d0'];
  };

  const getTextColor = (): string => {
    if (card.revealed || isSpymaster) {
      return card.type === 'assassin' ? '#ffffff' : '#2d3436';
    }
    return '#2d3436';
  };

  const colors = getCardColors();

  return (
    <Animated.View
      style={[
        styles.cardContainer,
        { width: cardSize, height: cardSize, transform: [{ scale: scaleAnim }] },
      ]}
    >
      <Pressable
        testID={`word-card-${card.id}`}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={({ pressed }) => [
          styles.cardPressable,
          Platform.OS === 'web' && !disabled ? ({ cursor: 'pointer' } as any) : {},
          pressed && !disabled && styles.cardPressed,
        ]}
      >
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.card, card.revealed && styles.cardRevealed]}
        >
          <Text style={[styles.cardText, { color: getTextColor() }]}>
            {card.word}
          </Text>
          {(card.revealed || isSpymaster) && card.type === 'assassin' && (
            <Text style={styles.assassinEmoji}>💀</Text>
          )}
          {!card.revealed && isSpymaster && (
            <View style={styles.spymasterOverlay}>
              <Text style={styles.spymasterLabel}>KEY</Text>
            </View>
          )}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

export default function GameScreen() {
  const router = useRouter();
  const windowDimensions = useWindowDimensions();
  const {
    roomState,
    roomCode,
    revealCard,
    endTurn,
    sendHint,
    toggleMic,
    resetGame,
    currentPlayer,
    setRole,
    selectTeam,
  } = useGame();

  const [hintWord, setHintWord] = useState<string>('');
  const [hintNumber, setHintNumber] = useState<number>(1);
  const [hintError, setHintError] = useState<string>('');

  const isWeb = Platform.OS === 'web';

  const boardWidth = useMemo(() => {
    const availableWidth = windowDimensions.width - 32;
    if (isWeb) {
      return Math.min(availableWidth, MAX_BOARD_WIDTH);
    }
    return availableWidth;
  }, [windowDimensions.width, isWeb]);

  const cardSize = useMemo(() => {
    return (boardWidth - CARD_MARGIN * (CARDS_PER_ROW + 1)) / CARDS_PER_ROW;
  }, [boardWidth]);

  useEffect(() => {
    if (!roomCode) {
      router.replace('/');
    }
  }, [roomCode, router]);

  const isSpymaster = useMemo(() => {
    if (!roomState || !currentPlayer || !currentPlayer.team) return false;
    const teamSpymasterKey = currentPlayer.team === 'red' ? 'redSpymasterId' : 'blueSpymasterId';
    return currentPlayer.role === 'spymaster' && roomState[teamSpymasterKey] === currentPlayer.id;
  }, [currentPlayer, roomState]);

  const canGuess = useMemo(() => {
    if (!roomState || !currentPlayer) return false;
    return (
      currentPlayer.role === 'guesser' &&
      currentPlayer.team === roomState.currentTeam &&
      !roomState.winner
    );
  }, [currentPlayer, roomState]);

  const isMicOn = useMemo(() => {
    if (!currentPlayer) return false;
    return !currentPlayer.micMuted;
  }, [currentPlayer]);

  const handleCardPress = async (cardId: string) => {
    console.log('[Game] Card pressed:', cardId, { canGuess, role: currentPlayer?.role, team: currentPlayer?.team });

    if (!canGuess) {
      return;
    }
    try {
      await revealCard(cardId);
    } catch (error) {
      console.warn('Failed to reveal card', error);
    }
  };

  const handleNewGame = async () => {
    try {
      await resetGame();
    } catch (error) {
      console.warn('Failed to reset game', error);
    }
  };

  const handleGoHome = () => {
    router.replace('/');
  };

  const handleSendHint = async () => {
    const trimmedHint = hintWord.trim();

    if (!trimmedHint) {
      setHintError('Please type a hint before sending.');
      return;
    }

    const wordCount = trimmedHint.split(/\s+/).length;
    if (wordCount > 1) {
      setHintError('Hint should be one word only.');
      return;
    }

    try {
      await sendHint(trimmedHint, hintNumber);
      setHintWord('');
      setHintNumber(1);
      setHintError('');
    } catch (error) {
      setHintError(error instanceof Error ? error.message : 'Unable to send hint.');
    }
  };

  const handleToggleMic = async () => {
    try {
      await toggleMic();
    } catch (error) {
      console.warn('Failed to toggle mic', error);
    }
  };

  const handleEndTurn = async () => {
    if (!isSpymaster) {
      return;
    }
    try {
      await endTurn();
    } catch (error) {
      console.warn('Failed to end turn', error);
    }
  };

  const renderWinnerModal = () => {
    if (!roomState || !roomState.winner) return null;

    const isAssassinated = roomState.winner === 'assassinated';
    const winningTeam = isAssassinated
      ? roomState.currentTeam === 'red'
        ? 'blue'
        : 'red'
      : roomState.winner;

    return (
      <View style={styles.modal}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>
            {isAssassinated ? '💀 Assassin!' : '🎉 Victory!'}
          </Text>
          <Text style={styles.modalText}>
            {isAssassinated
              ? `Team ${roomState.currentTeam.toUpperCase()} hit the assassin!`
              : `Team ${winningTeam?.toUpperCase()} wins!`}
          </Text>
          <Pressable onPress={handleNewGame} style={styles.modalButton} testID="reset-game-button">
            <LinearGradient
              colors={['#ffd369', '#f4c542']}
              style={styles.modalButtonGradient}
            >
              <Text style={styles.modalButtonText}>New Board</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    );
  };

  const handleMakeSpymaster = async () => {
    if (!currentPlayer || !currentPlayer.team) {
      if (Platform.OS === 'web') {
        alert('Please select a team first');
      } else {
        Alert.alert('Team Required', 'Please select a team first');
      }
      return;
    }

    try {
      await setRole('spymaster');
      const teamName = currentPlayer.team === 'red' ? 'Red' : 'Blue';
      console.log(`${teamName} Spymaster changed to ${currentPlayer.name}`);
    } catch (error) {
      console.warn('Failed to become spymaster', error);
    }
  };

  const handleStepDown = async () => {
    try {
      await setRole('guesser');
    } catch (error) {
      console.warn('Failed to step down', error);
    }
  };

  const handleTeamSelect = async (team: Team) => {
    try {
      await selectTeam(team);
    } catch (error) {
      console.warn('Failed to select team', error);
    }
  };

  const renderPlayerList = () => {
    if (!roomState) return null;

    return (
      <View style={styles.playerListContainer}>
        <View style={styles.playerList}>
          {roomState.players.map((player: Player) => (
            <View
              key={player.id}
              style={[styles.playerChip, player.role === 'spymaster' && styles.playerChipActive]}
            >
              <View
                style={[
                  styles.playerChipDot,
                  {
                    backgroundColor:
                      player.team === 'red'
                        ? '#ff6b6b'
                        : player.team === 'blue'
                        ? '#4ecdc4'
                        : 'rgba(255, 255, 255, 0.3)',
                  },
                ]}
              />
              <Text style={styles.playerChipText}>{player.name}</Text>
              {player.role === 'spymaster' && <Text style={styles.playerRoleTag}>SPY</Text>}
              {player.micMuted ? (
                <MicOff size={16} color="#ff6b6b" />
              ) : (
                <Mic size={16} color="#4ecdc4" />
              )}
            </View>
          ))}
        </View>

        {currentPlayer && (
          <View style={styles.roleControlsContainer}>
            {!currentPlayer.team && (
              <View style={styles.teamSelectionContainer}>
                <Text style={styles.roleControlsLabel}>Select your team:</Text>
                <View style={styles.teamButtons}>
                  <Pressable
                    onPress={() => handleTeamSelect('red')}
                    style={styles.teamButton}
                    testID="select-red-team"
                  >
                    <LinearGradient
                      colors={['#ff6b6b', '#ee5a52']}
                      style={styles.teamButtonGradient}
                    >
                      <Text style={styles.teamButtonText}>Red Team</Text>
                    </LinearGradient>
                  </Pressable>
                  <Pressable
                    onPress={() => handleTeamSelect('blue')}
                    style={styles.teamButton}
                    testID="select-blue-team"
                  >
                    <LinearGradient
                      colors={['#4ecdc4', '#44a7a0']}
                      style={styles.teamButtonGradient}
                    >
                      <Text style={styles.teamButtonText}>Blue Team</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              </View>
            )}

            {currentPlayer.team && (
              <View style={styles.roleButtonsContainer}>
                {currentPlayer.role === 'spymaster' ? (
                  <Pressable
                    onPress={handleStepDown}
                    style={styles.roleButton}
                    testID="step-down-button"
                  >
                    <LinearGradient
                      colors={['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.08)']}
                      style={styles.roleButtonGradient}
                    >
                      <ChevronsDown size={18} color="#ffd369" />
                      <Text style={styles.roleButtonText}>Step Down as Spymaster</Text>
                    </LinearGradient>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={handleMakeSpymaster}
                    style={styles.roleButton}
                    testID="make-spymaster-button"
                  >
                    <LinearGradient
                      colors={['#ffd369', '#f4c542']}
                      style={styles.roleButtonGradient}
                    >
                      <Crown size={18} color="#16213e" />
                      <Text style={[styles.roleButtonText, styles.roleButtonTextPrimary]}>
                        Become Spymaster
                      </Text>
                    </LinearGradient>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  if (!roomState) {
    return (
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ffd369" />
        <Text style={styles.loadingText}>Syncing room...</Text>
      </LinearGradient>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable onPress={handleGoHome} style={styles.iconButton} testID="go-home-button">
            <Home size={22} color="#ffffff" />
          </Pressable>

          <View style={styles.roomInfo}>
            <Text style={styles.roomCodeLabel}>Room</Text>
            <Text style={styles.roomCodeValue}>{roomState.roomCode}</Text>
          </View>

          <View style={styles.headerRight}>
            <Pressable
              onPress={handleToggleMic}
              style={[styles.iconButton, isMicOn && styles.micActive]}
              testID="toggle-mic-button"
            >
              {isMicOn ? <Mic size={22} color="#ffffff" /> : <MicOff size={22} color="#ffffff" />}
            </Pressable>
            <Pressable onPress={handleNewGame} style={styles.iconButton} testID="reset-board-button">
              <RotateCcw size={22} color="#ffffff" />
            </Pressable>
          </View>
        </View>

        <View style={styles.scoreContainer}>
          <View style={styles.scoreItem}>
            <Text style={styles.scoreLabel}>Red</Text>
            <Text style={styles.scoreText}>{roomState.redCardsLeft}</Text>
          </View>
          <View style={styles.turnDisplay}>
            <Text style={styles.turnLabel}>
              {roomState.currentTeam === 'red' ? 'Red Team Turn' : 'Blue Team Turn'}
            </Text>
            <View
              style={[
                styles.turnDot,
                { backgroundColor: roomState.currentTeam === 'red' ? '#ff6b6b' : '#4ecdc4' },
              ]}
            />
          </View>
          <View style={styles.scoreItem}>
            <Text style={styles.scoreLabel}>Blue</Text>
            <Text style={styles.scoreText}>{roomState.blueCardsLeft}</Text>
          </View>
        </View>

        {roomState.currentHint ? (
          <View style={styles.hintDisplayContainer}>
            <View style={styles.hintDisplay}>
              <Text style={styles.hintLabel}>Current Hint</Text>
              <Text style={styles.hintText}>
                “{roomState.currentHint.word}” - Count: {roomState.currentHint.number}
              </Text>
            </View>
            {roomState.hintHistory.length > 0 && (
              <View style={styles.hintHistory}>
                <Text style={styles.hintHistoryTitle}>Previous hints</Text>
                {roomState.hintHistory.map((hint: Hint, index: number) => (
                  <View key={`${hint.word}-${index}`} style={styles.hintHistoryItem}>
                    <View
                      style={[
                        styles.hintTeamDot,
                        { backgroundColor: hint.team === 'red' ? '#ff6b6b' : '#4ecdc4' },
                      ]}
                    />
                    <Text style={styles.hintHistoryText}>
                      {hint.team === 'red' ? 'Red' : 'Blue'}: {hint.word} {hint.number}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : null}

        {renderPlayerList()}
      </LinearGradient>

      <View style={styles.gameBoard}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.boardWrapper,
            isWeb && styles.boardWrapperWeb,
            { flexGrow: 1 }
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.gridContainer, { width: boardWidth }]}>
            {roomState.cards.map((card) => (
              <WordCard
                key={card.id}
                card={card}
                onPress={() => handleCardPress(card.id)}
                disabled={card.revealed}
                cardSize={cardSize}
                isSpymaster={isSpymaster}
              />
            ))}
          </View>

          {!roomState.winner && (
            <Pressable
              onPress={handleEndTurn}
              style={[styles.endTurnButton, !isSpymaster && styles.disabledButton, { width: boardWidth }]}
              disabled={!isSpymaster}
              testID="end-turn-button"
            >
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.08)']}
                style={styles.endTurnGradient}
              >
                <Text style={styles.endTurnText}>
                  {isSpymaster ? 'End Turn' : 'Only Spymaster can end turn'}
                </Text>
              </LinearGradient>
            </Pressable>
          )}
        </ScrollView>
      </View>

      {!roomState.winner && (
        <View style={styles.scrumMasterPanel}>
          <LinearGradient
            colors={['rgba(26, 26, 46, 0.98)', 'rgba(22, 33, 62, 0.98)']}
            style={styles.panelGradient}
          >
            <Text style={styles.panelTitle}>Spymaster</Text>
            {hintError ? <Text style={styles.errorText}>{hintError}</Text> : null}
            {isSpymaster ? (
              <View style={styles.inputRow}>
                <View style={styles.hintInputContainer}>
                  <Text style={styles.inputLabel}>Hint Word</Text>
                  <TextInput
                    testID="hint-input"
                    style={styles.textInput}
                    placeholder="Type your hint"
                    placeholderTextColor="#888"
                    value={hintWord}
                    onChangeText={(text) => {
                      setHintWord(text);
                      if (hintError) setHintError('');
                    }}
                    autoCapitalize="none"
                  />
                </View>
                <View style={styles.numberInputContainer}>
                  <Text style={styles.inputLabel}>Count</Text>
                  <View style={styles.numberSelector}>
                    <Pressable
                      onPress={() => setHintNumber(Math.max(1, hintNumber - 1))}
                      style={[styles.numberButton, hintNumber === 1 && styles.numberButtonDisabled]}
                      disabled={hintNumber === 1}
                      testID="count-decrement"
                    >
                      <Text
                        style={[styles.numberButtonText, hintNumber === 1 && styles.numberButtonTextDisabled]}
                      >
                        −
                      </Text>
                    </Pressable>
                    <Text style={styles.numberDisplay}>{hintNumber}</Text>
                    <Pressable
                      onPress={() => setHintNumber(Math.min(5, hintNumber + 1))}
                      style={[styles.numberButton, hintNumber === 5 && styles.numberButtonDisabled]}
                      disabled={hintNumber === 5}
                      testID="count-increment"
                    >
                      <Text
                        style={[styles.numberButtonText, hintNumber === 5 && styles.numberButtonTextDisabled]}
                      >
                        +
                      </Text>
                    </Pressable>
                  </View>
                </View>
                <Pressable
                  onPress={handleSendHint}
                  style={[styles.sendButton, !hintWord.trim() && styles.sendButtonDisabled]}
                  disabled={!hintWord.trim()}
                  testID="send-hint-button"
                >
                  <LinearGradient
                    colors={hintWord.trim() ? ['#ffd369', '#f4c542'] : ['#555', '#444']}
                    style={styles.sendButtonGradient}
                  >
                    <Send size={20} color={hintWord.trim() ? '#16213e' : '#888'} />
                  </LinearGradient>
                </Pressable>
              </View>
            ) : (
              <Text style={styles.helperText}>Only the Spymaster can send hints right now.</Text>
            )}
          </LinearGradient>
        </View>
      )}

      {renderWinnerModal()}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f3460',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#ffffff',
    fontSize: 16,
  },
  header: {
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  micActive: {
    backgroundColor: '#4ecdc4',
  },
  roomInfo: {
    alignItems: 'center',
  },
  roomCodeLabel: {
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#c0c4d6',
  },
  roomCodeValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 2,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  scoreItem: {
    alignItems: 'center',
    flex: 1,
  },
  scoreLabel: {
    color: '#c0c4d6',
    fontSize: 12,
    letterSpacing: 1,
  },
  scoreText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
  },
  turnDisplay: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  turnLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffd369',
  },
  turnDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  hintDisplayContainer: {
    marginTop: 12,
    gap: 8,
  },
  hintDisplay: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 211, 105, 0.15)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 211, 105, 0.3)',
  },
  hintLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffd369',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hintText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  hintHistory: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  hintHistoryTitle: {
    fontSize: 10,
    fontWeight: '600',
    color: '#aaa',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  hintHistoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  hintTeamDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  hintHistoryText: {
    fontSize: 13,
    color: '#ddd',
  },
  playerListContainer: {
    marginTop: 12,
    gap: 12,
  },
  playerList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  playerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  playerChipActive: {
    borderWidth: 1,
    borderColor: '#ffd369',
    backgroundColor: 'rgba(255, 211, 105, 0.2)',
  },
  playerChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  playerChipText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  playerRoleTag: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16213e',
    backgroundColor: '#ffd369',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  gameBoard: {
    flex: 1,
    backgroundColor: '#0f3460',
  },
  boardWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  boardWrapperWeb: {
    paddingVertical: 24,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: CARD_MARGIN,
  },
  cardContainer: {
    // marginBottom removed to rely on gap for consistent spacing
  },
  cardPressable: {
    flex: 1,
  },
  cardPressed: {
    opacity: 0.8,
  },
  card: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  cardRevealed: {
    opacity: 0.9,
  },
  cardText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
  },
  assassinEmoji: {
    fontSize: 20,
    position: 'absolute',
    top: 4,
    right: 4,
  },
  endTurnButton: {
    marginTop: 20,
    borderRadius: 16,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  endTurnGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  endTurnText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  disabledButton: {
    opacity: 0.5,
  },
  modal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    maxWidth: 500,
    width: '90%',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  modalTitle: {
    fontSize: 48,
    marginBottom: 16,
  },
  modalText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2d3436',
    marginBottom: 32,
    textAlign: 'center',
  },
  modalButton: {
    borderRadius: 16,
    overflow: 'hidden',
    width: '100%',
  },
  modalButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#16213e',
  },
  scrumMasterPanel: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  panelGradient: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  panelTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffd369',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
  },
  hintInputContainer: {
    flex: 1,
  },
  numberInputContainer: {
    width: 100,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#aaa',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  numberSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
  },
  numberButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  numberButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  numberButtonDisabled: {
    opacity: 0.3,
  },
  numberButtonTextDisabled: {
    color: '#666',
  },
  numberDisplay: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    paddingHorizontal: 12,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 12,
    color: '#ff6b6b',
    marginBottom: 6,
  },
  helperText: {
    color: '#c0c4d6',
    fontSize: 14,
  },
  spymasterOverlay: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    backgroundColor: 'rgba(255, 211, 105, 0.9)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  spymasterLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#16213e',
    letterSpacing: 0.5,
  },
  roleControlsContainer: {
    gap: 8,
  },
  roleControlsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#c0c4d6',
    marginBottom: 8,
  },
  teamSelectionContainer: {
    gap: 8,
  },
  teamButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  teamButton: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  teamButtonGradient: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  teamButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  roleButtonsContainer: {
    gap: 8,
  },
  roleButton: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  roleButtonGradient: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  roleButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffd369',
  },
  roleButtonTextPrimary: {
    color: '#16213e',
  },
});
