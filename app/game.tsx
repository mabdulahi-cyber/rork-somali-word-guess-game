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
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Home, RotateCcw, Send, Eye } from 'lucide-react-native';
import { useGame } from '@/contexts/game-context';
import { PlayersPanel } from '@/components/PlayersPanel';
import type { Card, Team, Role, CardType } from '@/types/game';

const CARD_MARGIN = 4;
const CARDS_PER_ROW = 5;
const MAX_BOARD_WIDTH = 600;

const CARD_COLORS: Record<CardType, { bg: string; text: string }> = {
  red: { bg: '#DC2626', text: '#FFFFFF' },
  blue: { bg: '#2563EB', text: '#FFFFFF' },
  neutral: { bg: '#D4B896', text: '#3D3D3D' },
  assassin: { bg: '#1A1A1A', text: '#FFFFFF' },
};

const UNREVEALED_CARD = { bg: '#F5F0E8', text: '#2D3436' };

interface WordCardProps {
  card: Card;
  onPress: () => void;
  disabled: boolean;
  cardSize: number;
  isSpymaster: boolean;
}

function WordCard({ card, onPress, disabled, cardSize, isSpymaster }: WordCardProps) {
  const [scaleAnim] = useState(new Animated.Value(1));
  const [flipAnim] = useState(new Animated.Value(card.revealed ? 1 : 0));

  useEffect(() => {
    if (card.revealed) {
      Animated.spring(flipAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    }
  }, [card.revealed, flipAnim]);

  const handlePressIn = () => {
    if (disabled) return;
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

  const getCardStyle = () => {
    if (card.revealed) {
      return CARD_COLORS[card.type];
    }
    if (isSpymaster) {
      return {
        bg: CARD_COLORS[card.type].bg + '40',
        text: '#FFFFFF',
        border: CARD_COLORS[card.type].bg,
      };
    }
    return UNREVEALED_CARD;
  };

  const cardStyle = getCardStyle();
  const fontSize = cardSize < 60 ? 9 : cardSize < 80 ? 11 : 13;

  return (
    <Animated.View
      style={[
        styles.cardContainer,
        { 
          width: cardSize, 
          height: cardSize * 0.75,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <Pressable
        testID={`word-card-${card.id}`}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={[
          styles.cardPressable,
          Platform.OS === 'web' && !disabled ? ({ cursor: 'pointer' } as any) : {},
        ]}
      >
        <View
          style={[
            styles.card,
            { 
              backgroundColor: cardStyle.bg,
              borderWidth: isSpymaster && !card.revealed ? 3 : 0,
              borderColor: isSpymaster && !card.revealed ? (cardStyle as any).border : 'transparent',
            },
            card.revealed && styles.cardRevealed,
          ]}
        >
          <Text 
            style={[
              styles.cardText, 
              { color: cardStyle.text, fontSize },
            ]}
            numberOfLines={2}
            adjustsFontSizeToFit
          >
            {card.word}
          </Text>
          
          {card.revealed && card.type === 'assassin' && (
            <Text style={styles.assassinEmoji}>💀</Text>
          )}
          
          {isSpymaster && !card.revealed && (
            <View style={[styles.spymasterBadge, { backgroundColor: CARD_COLORS[card.type].bg }]}>
              <Text style={styles.spymasterBadgeText}>
                {card.type === 'red' ? 'R' : card.type === 'blue' ? 'B' : card.type === 'assassin' ? '☠' : '•'}
              </Text>
            </View>
          )}
        </View>
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
    resetGame,
    currentPlayer,
    setRole,
    selectTeam,
    isRoomLoading,
    isInitializing,
  } = useGame();

  const [hintWord, setHintWord] = useState<string>('');
  const [hintNumber, setHintNumber] = useState<number>(1);
  const [hintError, setHintError] = useState<string>('');
  const [roomNotFound, setRoomNotFound] = useState<boolean>(false);

  

  const boardWidth = useMemo(() => {
    const availableWidth = windowDimensions.width - 24;
    return Math.min(availableWidth, MAX_BOARD_WIDTH);
  }, [windowDimensions.width]);

  const cardSize = useMemo(() => {
    return (boardWidth - CARD_MARGIN * (CARDS_PER_ROW + 1)) / CARDS_PER_ROW;
  }, [boardWidth]);

  useEffect(() => {
    if (isRoomLoading || isInitializing) {
      setRoomNotFound(false);
      return;
    }

    if (roomCode && !roomState) {
      console.log('[Game] Room not found for code:', roomCode);
      setRoomNotFound(true);
    }
  }, [roomCode, roomState, isRoomLoading, isInitializing]);

  const isSpymaster = useMemo(() => {
    if (!roomState || !currentPlayer || !currentPlayer.team) return false;
    const teamSpymasterKey = currentPlayer.team === 'red' ? 'redSpymasterId' : 'blueSpymasterId';
    return currentPlayer.role === 'spymaster' && roomState[teamSpymasterKey] === currentPlayer.id;
  }, [currentPlayer, roomState]);

  const canGuess = useMemo(() => {
    if (!roomState || !currentPlayer) return false;
    
    const isGuesser = currentPlayer.role === 'guesser';
    const isMyTeamTurn = currentPlayer.team === roomState.turn.turnTeam;
    const gameNotOver = !roomState.winner;
    const isGuessingPhase = roomState.turn.status === 'GUESSING';
    
    return isGuesser && isMyTeamTurn && gameNotOver && isGuessingPhase;
  }, [currentPlayer, roomState]);

  const handleCardPress = async (cardId: string) => {
    console.log('[Game] Card pressed:', cardId);

    if (!canGuess) {
      console.log('[Game] Cannot guess - conditions not met');
      return;
    }
    
    try {
      await revealCard(cardId);
      console.log('[Game] Card revealed successfully:', cardId);
    } catch (error) {
      console.error('[Game] Failed to reveal card:', cardId, error);
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

  const handleEndTurn = async () => {
    if (!canEndTurn) return;
    try {
      await endTurn();
    } catch (error) {
      console.warn('Failed to end turn', error);
    }
  };

  const canEndTurn = useMemo(() => {
    if (!roomState || !currentPlayer) return false;
    const isMyTeamTurn = currentPlayer.team === roomState.turn.turnTeam;
    const isGuessingPhase = roomState.turn.status === 'GUESSING';
    return isMyTeamTurn && !roomState.winner && isGuessingPhase;
  }, [currentPlayer, roomState]);

  const canSubmitHint = useMemo(() => {
    if (!roomState || !currentPlayer) return false;
    return (
      isSpymaster &&
      roomState.turn.status === 'WAITING_HINT' &&
      roomState.turn.turnTeam === currentPlayer.team &&
      !roomState.winner
    );
  }, [isSpymaster, roomState, currentPlayer]);

  const renderWinnerModal = () => {
    if (!roomState || !roomState.winner) return null;

    const isAssassinated = roomState.winner === 'assassinated';
    const winningTeam = isAssassinated
      ? roomState.currentTeam === 'red'
        ? 'blue'
        : 'red'
      : roomState.winner;

    const winnerColor = winningTeam === 'red' ? '#DC2626' : '#2563EB';

    return (
      <View style={styles.modal}>
        <View style={styles.modalContent}>
          <Text style={styles.modalEmoji}>
            {isAssassinated ? '💀' : '🎉'}
          </Text>
          <Text style={[styles.modalTitle, { color: winnerColor }]}>
            {isAssassinated ? 'Assassin!' : `${winningTeam?.toUpperCase()} Wins!`}
          </Text>
          <Text style={styles.modalText}>
            {isAssassinated
              ? `${roomState.currentTeam.toUpperCase()} team hit the assassin!`
              : `Congratulations to ${winningTeam?.toUpperCase()} team!`}
          </Text>
          <Pressable onPress={handleNewGame} style={styles.modalButton} testID="reset-game-button">
            <LinearGradient
              colors={['#ffd369', '#f4c542']}
              style={styles.modalButtonGradient}
            >
              <Text style={styles.modalButtonText}>New Game</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    );
  };

  const handleChangeRole = async (role: Role) => {
    try {
      await setRole(role);
    } catch (error) {
      console.warn('Failed to change role', error);
      if (Platform.OS === 'web') {
        alert(error instanceof Error ? error.message : 'Failed to change role');
      } else {
        Alert.alert('Error', error instanceof Error ? error.message : 'Failed to change role');
      }
    }
  };

  const handleSwitchTeam = async (team: Team) => {
    try {
      await selectTeam(team);
    } catch (error) {
      console.warn('Failed to select team', error);
    }
  };

  if (isInitializing || (isRoomLoading && !roomState)) {
    return (
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ffd369" />
        <Text style={styles.loadingText}>Syncing room...</Text>
      </LinearGradient>
    );
  }

  if (roomNotFound) {
    return (
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.loadingContainer}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Room Not Found</Text>
          <Text style={styles.errorMessage}>
            The room code {roomCode} doesn&apos;t exist or has expired.
          </Text>
          <Pressable onPress={handleGoHome} style={styles.errorButton} testID="go-home-from-error">
            <LinearGradient colors={['#ffd369', '#f4c542']} style={styles.errorButtonGradient}>
              <Text style={styles.errorButtonText}>Go to Home</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </LinearGradient>
    );
  }

  if (!roomState) {
    return (
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ffd369" />
        <Text style={styles.loadingText}>Loading...</Text>
      </LinearGradient>
    );
  }

  const turnTeamColor = roomState.turn.turnTeam === 'red' ? '#DC2626' : '#2563EB';

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Pressable onPress={handleGoHome} style={styles.iconButton} testID="go-home-button">
              <Home size={20} color="#ffffff" />
            </Pressable>

            <View style={styles.roomInfo}>
              <Text style={styles.roomCodeLabel}>Room</Text>
              <Text style={styles.roomCodeValue}>{roomState.roomCode}</Text>
            </View>

            <Pressable onPress={handleNewGame} style={styles.iconButton} testID="reset-board-button">
              <RotateCcw size={20} color="#ffffff" />
            </Pressable>
          </View>

          <View style={[styles.turnBanner, { backgroundColor: turnTeamColor }]}>
            <Text style={styles.turnBannerText}>
              {roomState.winner 
                ? 'Game Over' 
                : `${roomState.turn.turnTeam.toUpperCase()} TEAM'S TURN`}
            </Text>
            {!roomState.winner && roomState.turn.status === 'WAITING_HINT' && (
              <Text style={styles.turnSubtext}>Waiting for hint...</Text>
            )}
            {!roomState.winner && roomState.turn.status === 'GUESSING' && (
              <Text style={styles.turnSubtext}>
                {roomState.turn.guessesLeft === 999 
                  ? 'Unlimited guesses' 
                  : `${roomState.turn.guessesLeft} guesses left`}
              </Text>
            )}
          </View>

          <View style={styles.scoreRow}>
            <View style={[styles.scoreBox, { backgroundColor: '#DC2626' }]}>
              <Text style={styles.scoreNumber}>{roomState.redCardsLeft}</Text>
              <Text style={styles.scoreLabel}>RED</Text>
            </View>
            
            {roomState.currentHint && (
              <View style={styles.hintBox}>
                <Text style={styles.hintLabel}>HINT</Text>
                <Text style={styles.hintWord}>&quot;{roomState.currentHint.word}&quot;</Text>
                <Text style={styles.hintCount}>{roomState.currentHint.number}</Text>
              </View>
            )}
            
            <View style={[styles.scoreBox, { backgroundColor: '#2563EB' }]}>
              <Text style={styles.scoreNumber}>{roomState.blueCardsLeft}</Text>
              <Text style={styles.scoreLabel}>BLUE</Text>
            </View>
          </View>

          {isSpymaster && (
            <View style={styles.spymasterIndicator}>
              <Eye size={14} color="#ffd369" />
              <Text style={styles.spymasterIndicatorText}>You are the Spymaster</Text>
            </View>
          )}
        </View>

        <ScrollView
          style={styles.boardScroll}
          contentContainerStyle={styles.boardContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.gridContainer, { width: boardWidth }]}>
            {roomState.cards.map((card) => (
              <WordCard
                key={card.id}
                card={card}
                onPress={() => handleCardPress(card.id)}
                disabled={card.revealed || !canGuess}
                cardSize={cardSize}
                isSpymaster={isSpymaster}
              />
            ))}
          </View>

          {!roomState.winner && roomState.turn.status === 'GUESSING' && canEndTurn && (
            <Pressable
              onPress={handleEndTurn}
              style={[styles.endTurnButton, { maxWidth: boardWidth }]}
              testID="end-turn-button"
            >
              <Text style={styles.endTurnText}>End Turn</Text>
            </Pressable>
          )}

          <PlayersPanel
            players={roomState.players}
            currentPlayerId={currentPlayer?.id || ''}
            onSwitchTeam={handleSwitchTeam}
            onChangeRole={handleChangeRole}
          />
        </ScrollView>

        {!roomState.winner && (
          <View style={styles.hintPanel}>
            <View style={styles.hintPanelHeader}>
              <Eye size={16} color="#ffd369" />
              <Text style={styles.hintPanelTitle}>Spymaster Hint</Text>
            </View>
            
            {canSubmitHint ? (
              <View style={styles.hintInputRow}>
                <View style={styles.hintWordInput}>
                  <TextInput
                    testID="hint-input"
                    style={styles.textInput}
                    placeholder="One word hint..."
                    placeholderTextColor="#666"
                    value={hintWord}
                    onChangeText={(text) => {
                      setHintWord(text);
                      if (hintError) setHintError('');
                    }}
                    autoCapitalize="none"
                  />
                </View>
                <View style={styles.hintNumberInput}>
                  <Pressable
                    onPress={() => setHintNumber(Math.max(0, hintNumber - 1))}
                    style={styles.numberBtn}
                    testID="count-decrement"
                  >
                    <Text style={styles.numberBtnText}>−</Text>
                  </Pressable>
                  <Text style={styles.numberValue}>{hintNumber}</Text>
                  <Pressable
                    onPress={() => setHintNumber(Math.min(9, hintNumber + 1))}
                    style={styles.numberBtn}
                    testID="count-increment"
                  >
                    <Text style={styles.numberBtnText}>+</Text>
                  </Pressable>
                </View>
                <Pressable
                  onPress={handleSendHint}
                  style={[styles.sendBtn, !hintWord.trim() && styles.sendBtnDisabled]}
                  disabled={!hintWord.trim()}
                  testID="send-hint-button"
                >
                  <Send size={18} color={hintWord.trim() ? '#16213e' : '#888'} />
                </Pressable>
              </View>
            ) : (
              <Text style={styles.hintPanelInfo}>
                {isSpymaster && roomState.turn.turnTeam !== currentPlayer?.team
                  ? "Wait for your team's turn"
                  : isSpymaster && roomState.turn.status === 'GUESSING'
                  ? 'Your team is guessing...'
                  : 'Only the spymaster can give hints'}
              </Text>
            )}
            {hintError ? <Text style={styles.hintError}>{hintError}</Text> : null}
          </View>
        )}

        {renderWinnerModal()}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
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
  errorContainer: {
    alignItems: 'center',
    paddingHorizontal: 32,
    maxWidth: 500,
  },
  errorTitle: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: '#ffffff',
    marginBottom: 16,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#c0c4d6',
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 24,
  },
  errorButton: {
    borderRadius: 16,
    overflow: 'hidden',
    width: '100%',
  },
  errorButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  errorButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#16213e',
  },
  header: {
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  roomInfo: {
    alignItems: 'center',
  },
  roomCodeLabel: {
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#888',
  },
  roomCodeValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#ffffff',
    letterSpacing: 2,
  },
  turnBanner: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  turnBannerText: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: '#ffffff',
    letterSpacing: 1,
  },
  turnSubtext: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  scoreBox: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  scoreNumber: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: '#ffffff',
  },
  scoreLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 1,
  },
  hintBox: {
    flex: 2,
    backgroundColor: 'rgba(255, 211, 105, 0.15)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 211, 105, 0.3)',
  },
  hintLabel: {
    fontSize: 9,
    fontWeight: '600' as const,
    color: '#ffd369',
    letterSpacing: 1,
  },
  hintWord: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#ffffff',
  },
  hintCount: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#ffd369',
  },
  spymasterIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 211, 105, 0.1)',
    borderRadius: 8,
  },
  spymasterIndicatorText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#ffd369',
  },
  boardScroll: {
    flex: 1,
  },
  boardContainer: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_MARGIN,
    justifyContent: 'center',
  },
  cardContainer: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  cardPressable: {
    flex: 1,
  },
  card: {
    flex: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  cardRevealed: {
    elevation: 1,
    shadowOpacity: 0.1,
  },
  cardText: {
    fontWeight: '700' as const,
    textAlign: 'center',
    lineHeight: 14,
  },
  assassinEmoji: {
    fontSize: 16,
    position: 'absolute',
    bottom: 2,
    right: 2,
  },
  spymasterBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spymasterBadgeText: {
    fontSize: 9,
    fontWeight: '800' as const,
    color: '#ffffff',
  },
  endTurnButton: {
    marginTop: 16,
    backgroundColor: '#ffd369',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignSelf: 'center',
  },
  endTurnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#16213e',
    textAlign: 'center',
  },
  hintPanel: {
    backgroundColor: '#1a1a2e',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  hintPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  hintPanelTitle: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#ffd369',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hintInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hintWordInput: {
    flex: 1,
  },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  hintNumberInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  numberBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  numberBtnText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#ffffff',
  },
  numberValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#ffffff',
    minWidth: 24,
    textAlign: 'center',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffd369',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#444',
  },
  hintPanelInfo: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
  },
  hintError: {
    color: '#ff6b6b',
    fontSize: 12,
    marginTop: 6,
  },
  modal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    maxWidth: 400,
    width: '90%',
  },
  modalEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 32,
    fontWeight: '800' as const,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    color: '#666',
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
    fontWeight: '700' as const,
    color: '#16213e',
  },
});
