import { useCallback, useEffect, useMemo, useState } from "react";
import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { db } from "@/lib/database";
import type { Player, Role, RoomState, Team, Card, CardType } from "@/types/game";
import { SOMALI_WORDS } from "@/constants/somali-words";

interface GameContextValue {
  playerId: string;
  playerName: string;
  roomCode: string | null;
  roomState: RoomState | null;
  currentPlayer: Player | null;
  isRoomLoading: boolean;
  isInitializing: boolean;
  createRoom: (name: string) => Promise<void>;
  joinRoom: (name: string, code: string) => Promise<void>;
  selectTeam: (team: Team) => Promise<void>;
  setRole: (role: Role) => Promise<void>;
  revealCard: (cardId: string) => Promise<void>;
  sendHint: (word: string, number: number) => Promise<void>;
  endTurn: () => Promise<void>;
  resetGame: () => Promise<void>;
  toggleMic: () => Promise<void>;
  leaveRoom: () => void;
  refetchRoom: () => Promise<void>;
  setRoomCode: (code: string) => void;
}

const CLIENT_ID_STORAGE_KEY = "somali-codenames.clientId" as const;
const ROOM_CODE_STORAGE_KEY = "somali-codenames.roomCode" as const;

const generateClientId = (): string => {
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
};

const tryLoadClientId = async (): Promise<string> => {
  try {
    const existing = await AsyncStorage.getItem(CLIENT_ID_STORAGE_KEY);
    if (existing?.trim()) return existing;
    const created = generateClientId();
    await AsyncStorage.setItem(CLIENT_ID_STORAGE_KEY, created);
    return created;
  } catch (error) {
    console.warn("[GameContext] Failed to load clientId from storage", error);
    return generateClientId();
  }
};

const generateRoomCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const generateBoard = () => {
  // Select 25 random words
  const shuffledWords = [...SOMALI_WORDS].sort(() => 0.5 - Math.random());
  const selectedWords = shuffledWords.slice(0, 25);

  // Determine starting team (9 cards vs 8 cards)
  const startingTeam: Team = Math.random() < 0.5 ? 'red' : 'blue';
  const secondTeam: Team = startingTeam === 'red' ? 'blue' : 'red';

  // Create key map
  // 9 starting team, 8 second team, 7 neutral, 1 assassin
  const types: CardType[] = [
    ...Array(9).fill(startingTeam),
    ...Array(8).fill(secondTeam),
    ...Array(7).fill('neutral'),
    ...Array(1).fill('assassin'),
  ];

  // Shuffle types
  const shuffledTypes = types.sort(() => 0.5 - Math.random());

  // Create cards
  const cards: Card[] = selectedWords.map((word, index) => ({
    id: `card-${index}`,
    word,
    type: shuffledTypes[index],
    revealed: false,
    revealedByTeam: null,
  }));

  return { cards, startingTeam };
};

export const [GameProvider, useGame] = createContextHook<GameContextValue>(() => {
  const [playerId, setPlayerId] = useState<string>("");
  const [playerName, setPlayerName] = useState<string>("");
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [isRoomLoading, setIsRoomLoading] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  // Initialize player ID
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const id = await tryLoadClientId();
      if (cancelled) return;
      setPlayerId(id);
      console.log("[GameContext] playerId (clientId)", id);

      try {
        const storedRoomCode = await AsyncStorage.getItem(ROOM_CODE_STORAGE_KEY);
        if (storedRoomCode?.trim()) {
          console.log("[GameContext] Loaded roomCode from storage:", storedRoomCode);
          setRoomCode(storedRoomCode);
        }
      } catch (error) {
        console.warn("[GameContext] Failed to load roomCode from storage", error);
      } finally {
        setIsInitializing(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, []);

  const fetchSnapshot = useCallback(async (code: string) => {
    if (!code) return;
    
    try {
      const roomData = await db.getRoom(code);
      
      if (!roomData) {
        console.log("[GameContext] Room not found");
        setRoomState(null);
        return;
      }

      const playersData = await db.getPlayersByRoom(code);

      const cards = roomData.words.map((word: string, index: number) => ({
        id: `card-${index}`,
        word,
        type: roomData.key_map[index],
        revealed: roomData.revealed[index],
        revealedByTeam: null, // We might need to store this if needed, for now null is fine or we can guess
      }));

      const redCardsLeft = cards.filter(c => c.type === 'red' && !c.revealed).length;
      const blueCardsLeft = cards.filter(c => c.type === 'blue' && !c.revealed).length;

      const spymasters = {
        red: playersData.find((p: any) => p.team === 'red' && p.role === 'spymaster')?.id || null,
        blue: playersData.find((p: any) => p.team === 'blue' && p.role === 'spymaster')?.id || null,
      };

      const newState: RoomState = {
        roomCode: roomData.code,
        cards,
        currentTeam: roomData.turn_team as Team,
        redCardsLeft,
        blueCardsLeft,
        winner: roomData.game_status === 'ENDED' ? 
          (roomData.winner_team as Team | 'assassinated') : null, // Assuming winner_team column or derived
        gameStarted: true,
        currentHint: (roomData.hint_word && typeof roomData.hint_number === 'number') ? {
          word: roomData.hint_word,
          number: roomData.hint_number,
          team: roomData.turn_team as Team,
        } : null,
        hintHistory: [], // Not implementing history for now unless we add a table for it
        turn: {
          turnTeam: roomData.turn_team as Team,
          status: roomData.turn_status as 'WAITING_HINT' | 'GUESSING',
          hintWord: roomData.hint_word ?? null,
          hintNumber: roomData.hint_number ?? null,
          guessesLeft: roomData.guesses_left,
        },
        version: roomData.version,
        lastEvent: null,
        players: playersData.map((p: any) => ({
          id: p.id,
          name: p.name,
          team: p.team,
          role: p.role,
          micMuted: true, // Not synced yet
        })),
        redSpymasterId: spymasters.red,
        blueSpymasterId: spymasters.blue,
      };

      setRoomState(newState);
    } catch (error) {
      console.error("[GameContext] fetchSnapshot exception", error);
    }
  }, []);

  useEffect(() => {
    if (!roomCode) return;

    console.log("[GameContext] Setting up polling for room:", roomCode);
    const interval = setInterval(() => {
      fetchSnapshot(roomCode);
    }, 2000);

    return () => {
      clearInterval(interval);
    };
  }, [roomCode, fetchSnapshot]);

  // Initial fetch when roomCode changes
  useEffect(() => {
    if (roomCode) {
      setIsRoomLoading(true);
      fetchSnapshot(roomCode).finally(() => setIsRoomLoading(false));
    } else {
      setRoomState(null);
    }
  }, [roomCode, fetchSnapshot]);

  const normalizeErrorForUi = (error: unknown): string => {
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object') {
      const anyErr = error as any;
      const message =
        (typeof anyErr?.message === 'string' && anyErr.message) ||
        (typeof anyErr?.toString === 'function' ? String(anyErr.toString()) : 'Unknown error');
      const code = typeof anyErr?.code === 'string' ? anyErr.code : '';
      const details = typeof anyErr?.details === 'string' ? anyErr.details : '';
      const hint = typeof anyErr?.hint === 'string' ? anyErr.hint : '';

      console.error('[GameContext] Backend Error (structured):', JSON.stringify({
        message,
        code,
        details,
        hint,
        name: typeof anyErr?.name === 'string' ? anyErr.name : undefined,
      }, null, 2));

      let out = message;
      if (code) out += ` (${code})`;
      if (details) out += ` - ${details}`;
      if (hint) out += ` Hint: ${hint}`;
      return out;
    }

    return 'Unknown error';
  };

  const createRoom = useCallback(async (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error('Name is required');
    if (!playerId) throw new Error('Player ID not ready');

    const code = generateRoomCode();
    const { cards, startingTeam } = generateBoard();

    const words = cards.map((c) => c.word);
    const keyMap = cards.map((c) => c.type);

    try {
      console.log('[GameContext] createRoom - generating code:', code);

      await db.createRoom(code, words, keyMap, startingTeam);
      console.log('[GameContext] createRoom - Room created successfully:', code);

      console.log('[GameContext] createRoom - Creating/updating player:', playerId);

      const existingPlayer = await db.getPlayer(playerId);
      if (existingPlayer) {
        await db.updatePlayer(playerId, {
          room_code: code,
          name: trimmedName,
          team: 'red',
          role: 'guesser',
          is_active: true,
        });
      } else {
        await db.createPlayer(playerId, code, trimmedName);
        await db.updatePlayer(playerId, {
          team: 'red',
          role: 'guesser',
          is_active: true,
        });
      }

      setPlayerName(trimmedName);
      setRoomCode(code);
      await AsyncStorage.setItem(ROOM_CODE_STORAGE_KEY, code);

      console.log('[GameContext] createRoom - SUCCESS', { code, playerId });
    } catch (error) {
      console.error('[GameContext] createRoom - FAILED');
      console.error('[GameContext] createRoom error details:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      const msg = normalizeErrorForUi(error);
      console.error('[GameContext] createRoom normalized error:', msg);
      throw new Error(msg);
    }
  }, [playerId]);

  const joinRoom = useCallback(async (name: string, code: string) => {
    const trimmedName = name.trim();
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedName || !trimmedCode) throw new Error('Name and room code are required');
    if (!playerId) throw new Error('Player ID not ready');

    try {
      console.log('[GameContext] joinRoom - checking room exists', { code: trimmedCode });
      const room = await db.getRoom(trimmedCode);

      if (!room) {
        throw new Error('Room not found');
      }

      console.log('[GameContext] joinRoom - creating/updating player', { playerId, code: trimmedCode });
      const existing = await db.getPlayer(playerId);

      if (existing) {
        await db.updatePlayer(playerId, {
          room_code: trimmedCode,
          name: trimmedName,
          is_active: true,
        });
      } else {
        await db.createPlayer(playerId, trimmedCode, trimmedName);
      }

      setPlayerName(trimmedName);
      setRoomCode(trimmedCode);
      await AsyncStorage.setItem(ROOM_CODE_STORAGE_KEY, trimmedCode);

      console.log('[GameContext] joinRoom - SUCCESS', { code: trimmedCode, playerId });
    } catch (error) {
      console.error('[GameContext] joinRoom - FAILED');
      console.error('[GameContext] joinRoom error details:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      const msg = normalizeErrorForUi(error);
      console.error('[GameContext] joinRoom normalized error:', msg);
      throw new Error(msg);
    }
  }, [playerId]);

  const selectTeam = useCallback(async (team: Team) => {
    if (!roomCode || !playerId) return;
    
    await db.updatePlayer(playerId, { team, role: 'guesser' });
  }, [roomCode, playerId]);

  const setRole = useCallback(async (role: Role) => {
    if (!roomCode || !playerId) return;

    if (role === 'spymaster' && roomState) {
        const player = roomState.players.find(p => p.id === playerId);
        const currentSpymasterId = player?.team === 'red' ? roomState.redSpymasterId : roomState.blueSpymasterId;
        if (currentSpymasterId && currentSpymasterId !== playerId) {
            throw new Error("Already has a spymaster");
        }
    }

    await db.updatePlayer(playerId, { role });
  }, [roomCode, playerId, roomState]);

  const revealCard = useCallback(async (cardId: string) => {
    if (!roomCode || !playerId || !roomState) return;

    console.log('[GameContext] revealCard called', { cardId, roomCode });

    const index = parseInt(cardId.split('-')[1]);
    
    const room = await db.getRoom(roomCode);
    if (!room) {
      console.warn('[GameContext] revealCard - room not found');
      return;
    }

    if (room.revealed[index]) {
      console.log('[GameContext] revealCard - card already revealed');
      return;
    }

    const newRevealed = [...room.revealed];
    newRevealed[index] = true;
    
    const cardType = room.key_map[index] as CardType;
    let turnTeam = room.turn_team;
    let turnStatus = room.turn_status;
    let guessesLeft = room.guesses_left;
    let gameStatus = room.game_status;
    let winner = room.winner_team;

    console.log('[GameContext] Card revealed', { cardType, currentTeam: turnTeam });

    let shouldEndTurn = false;
    
    if (cardType === 'assassin') {
        console.log('[GameContext] Assassin revealed - game over');
        gameStatus = 'ENDED';
        winner = turnTeam === 'red' ? 'blue' : 'red';
    } else if (cardType === 'neutral') {
        console.log('[GameContext] Neutral card - ending turn');
        shouldEndTurn = true;
    } else if (cardType !== turnTeam) {
        console.log('[GameContext] Wrong team card - ending turn');
        shouldEndTurn = true;
    } else {
        console.log('[GameContext] Correct guess');
        if (guessesLeft > 0) {
          guessesLeft -= 1;
        }
        if (guessesLeft === 0) {
            shouldEndTurn = true;
        }
    }

    const totalRed = room.key_map.filter((t: string) => t === 'red').length;
    const totalBlue = room.key_map.filter((t: string) => t === 'blue').length;
    
    let revealedRed = 0;
    let revealedBlue = 0;
    
    room.key_map.forEach((t: string, i: number) => {
        if (t === 'red' && newRevealed[i]) revealedRed++;
        if (t === 'blue' && newRevealed[i]) revealedBlue++;
    });
    
    if (gameStatus !== 'ENDED') {
        if (revealedRed === totalRed) {
            console.log('[GameContext] Red team wins - all cards revealed');
            gameStatus = 'ENDED';
            winner = 'red';
        } else if (revealedBlue === totalBlue) {
            console.log('[GameContext] Blue team wins - all cards revealed');
            gameStatus = 'ENDED';
            winner = 'blue';
        }
    }

    if (shouldEndTurn && gameStatus !== 'ENDED') {
        console.log('[GameContext] Switching turn to other team');
        turnTeam = turnTeam === 'red' ? 'blue' : 'red';
        turnStatus = 'WAITING_HINT';
        guessesLeft = 0;
    }

    await db.updateRoom(roomCode, {
        revealed: newRevealed,
        turn_team: turnTeam,
        turn_status: turnStatus,
        guesses_left: guessesLeft,
        game_status: gameStatus,
        winner_team: winner
    });

    console.log('[GameContext] revealCard - room updated successfully');
  }, [roomCode, playerId, roomState]);

  const sendHint = useCallback(async (word: string, number: number) => {
    if (!roomCode) return;

    await db.updateRoom(roomCode, {
        hint_word: word,
        hint_number: number,
        turn_status: 'GUESSING',
        guesses_left: number + 1
    });
  }, [roomCode]);

  const endTurn = useCallback(async () => {
    if (!roomCode || !roomState) return;

    const nextTeam = roomState.currentTeam === 'red' ? 'blue' : 'red';
    
    await db.updateRoom(roomCode, {
        turn_team: nextTeam,
        turn_status: 'WAITING_HINT',
        guesses_left: 0,
        hint_word: undefined,
        hint_number: undefined
    });
  }, [roomCode, roomState]);

  const resetGame = useCallback(async () => {
    if (!roomCode) return;
    
    const { cards, startingTeam } = generateBoard();
    const words = cards.map(c => c.word);
    const keyMap = cards.map(c => c.type);

    await db.updateRoom(roomCode, {
        words,
        key_map: keyMap,
        revealed: Array(25).fill(false),
        turn_team: startingTeam,
        turn_status: 'WAITING_HINT',
        game_status: 'PLAYING',
        winner_team: undefined,
        hint_word: undefined,
        hint_number: undefined,
        guesses_left: 0,
        version: (roomState?.version || 0) + 1
    });
  }, [roomCode, roomState]);

  const toggleMic = useCallback(async () => {
    // Not implemented for now, just local state?
    // Or we can update 'players' table 'mic_muted' column if we added it?
    // For now, let's ignore or just log.
    console.log("Toggle mic not fully implemented without media server");
  }, []);

  const leaveRoom = useCallback(async () => {
    if (roomCode && playerId) {
        await db.updatePlayer(playerId, { is_active: false });
    }
    setRoomCode(null);
    setRoomState(null);
    setPlayerName("");
    void AsyncStorage.removeItem(ROOM_CODE_STORAGE_KEY);
  }, [roomCode, playerId]);

  const refetchRoom = useCallback(async () => {
    if (roomCode) await fetchSnapshot(roomCode);
  }, [roomCode, fetchSnapshot]);

  const currentPlayer = useMemo(() => {
    if (!roomState || !playerId) return null;
    return roomState.players.find((p) => p.id === playerId) ?? null;
  }, [playerId, roomState]);

  const setRoomCodeAndPersist = useCallback(async (code: string) => {
    setRoomCode(code);
    await AsyncStorage.setItem(ROOM_CODE_STORAGE_KEY, code);
  }, []);

  return {
    playerId,
    playerName,
    roomCode,
    roomState,
    currentPlayer,
    isRoomLoading,
    isInitializing,
    createRoom,
    joinRoom,
    selectTeam,
    setRole,
    revealCard,
    sendHint,
    endTurn,
    resetGame,
    toggleMic,
    leaveRoom,
    refetchRoom,
    setRoomCode: setRoomCodeAndPersist,
  };
});
