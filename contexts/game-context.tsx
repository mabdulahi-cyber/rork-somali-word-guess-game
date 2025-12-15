import { useCallback, useMemo, useState } from "react";
import createContextHook from "@nkzw/create-context-hook";
import { SOMALI_WORDS } from "@/constants/somali-words";
import type { Card, CardType, Player, Role, RoomState, Team } from "@/types/game";

interface GameContextValue {
  playerId: string;
  playerName: string;
  roomCode: string | null;
  roomState: RoomState | null;
  currentPlayer: Player | null;
  isRoomLoading: boolean;
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
}

const generatePlayerId = () => `player-${Math.random().toString(36).slice(2, 10)}`;

const generateRoomCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

const pickWords = (count: number) => {
  const pool = [...SOMALI_WORDS];
  const result: string[] = [];
  while (result.length < count && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length);
    result.push(pool.splice(idx, 1)[0] ?? "");
  }
  return result.filter(Boolean);
};

const shuffle = <T,>(arr: T[]): T[] => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j] as T;
    copy[j] = tmp as T;
  }
  return copy;
};

const buildNewDeck = () => {
  const words = pickWords(25);

  const types: CardType[] = shuffle([
    ...Array.from({ length: 9 }, () => "red" as const),
    ...Array.from({ length: 8 }, () => "blue" as const),
    ...Array.from({ length: 7 }, () => "neutral" as const),
    "assassin" as const,
  ]);

  const cards: Card[] = words.map((word, idx) => ({
    id: `card-${idx}-${word.toLowerCase()}`,
    word,
    type: types[idx] ?? "neutral",
    revealed: false,
    revealedByTeam: null,
  }));

  const redCardsLeft = cards.filter((c) => c.type === "red").length;
  const blueCardsLeft = cards.filter((c) => c.type === "blue").length;

  return { cards, redCardsLeft, blueCardsLeft };
};

const computeWinner = (state: RoomState): RoomState["winner"] => {
  if (state.cards.some((c) => c.revealed && c.type === "assassin")) {
    return "assassinated";
  }
  if (state.redCardsLeft <= 0) return "red";
  if (state.blueCardsLeft <= 0) return "blue";
  return null;
};

export const [GameProvider, useGame] = createContextHook<GameContextValue>(() => {
  const [playerId] = useState<string>(() => generatePlayerId());
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string>("");
  const [roomState, setRoomState] = useState<RoomState | null>(null);

  const currentPlayer = useMemo(() => {
    if (!roomState) return null;
    return roomState.players.find((p) => p.id === playerId) ?? null;
  }, [playerId, roomState]);

  const createRoom = useCallback(
    async (name: string) => {
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error("Name is required");

      const code = generateRoomCode();
      const deck = buildNewDeck();

      const player: Player = {
        id: playerId,
        name: trimmedName,
        team: null,
        role: "guesser",
        micMuted: false,
      };

      const nextRoom: RoomState = {
        roomCode: code,
        players: [player],
        scrumMasterId: null,
        cards: deck.cards,
        currentTeam: "red",
        redCardsLeft: deck.redCardsLeft,
        blueCardsLeft: deck.blueCardsLeft,
        winner: null,
        gameStarted: true,
        currentHint: null,
        hintHistory: [],
      };

      console.log("[GameContext] createRoom (stub)", { code, playerId });
      setRoomCode(code);
      setPlayerName(trimmedName);
      setRoomState(nextRoom);
    },
    [playerId]
  );

  const joinRoom = useCallback(
    async (name: string, code: string) => {
      const trimmedName = name.trim();
      const trimmedCode = code.trim().toUpperCase();
      if (!trimmedName || !trimmedCode) throw new Error("Name and room code are required");

      console.log("[GameContext] joinRoom (stub)", { trimmedCode, playerId });

      setRoomState((prev) => {
        const baseRoom =
          prev && prev.roomCode.toUpperCase() === trimmedCode
            ? prev
            : {
                roomCode: trimmedCode,
                players: [] as Player[],
                scrumMasterId: null,
                ...(() => {
                  const deck = buildNewDeck();
                  return {
                    cards: deck.cards,
                    currentTeam: "red" as const,
                    redCardsLeft: deck.redCardsLeft,
                    blueCardsLeft: deck.blueCardsLeft,
                    winner: null,
                    gameStarted: true,
                    currentHint: null,
                    hintHistory: [],
                  };
                })(),
              };

        const already = baseRoom.players.some((p) => p.id === playerId);
        const nextPlayers = already
          ? baseRoom.players.map((p) => (p.id === playerId ? { ...p, name: trimmedName } : p))
          : [
              ...baseRoom.players,
              {
                id: playerId,
                name: trimmedName,
                team: null,
                role: "guesser" as const,
                micMuted: false,
              },
            ];

        return { ...baseRoom, players: nextPlayers };
      });

      setRoomCode(trimmedCode);
      setPlayerName(trimmedName);
    },
    [playerId]
  );

  const selectTeam = useCallback(
    async (team: Team) => {
      if (!roomCode) throw new Error("Join a room first");
      console.log("[GameContext] selectTeam (stub)", { roomCode, playerId, team });

      setRoomState((prev) => {
        if (!prev) throw new Error("Room not found");
        const nextPlayers = prev.players.map((p) => (p.id === playerId ? { ...p, team } : p));
        return { ...prev, players: nextPlayers };
      });
    },
    [playerId, roomCode]
  );

  const setRole = useCallback(
    async (role: Role) => {
      if (!roomCode) throw new Error("Join a room first");
      console.log("[GameContext] setRole (stub)", { roomCode, playerId, role });

      setRoomState((prev) => {
        if (!prev) throw new Error("Room not found");

        let scrumMasterId = prev.scrumMasterId;
        if (role === "scrumMaster") {
          scrumMasterId = playerId;
        } else if (scrumMasterId === playerId) {
          scrumMasterId = null;
        }

        const nextPlayers = prev.players.map((p) => (p.id === playerId ? { ...p, role } : p));
        return { ...prev, players: nextPlayers, scrumMasterId };
      });
    },
    [playerId, roomCode]
  );

  const revealCard = useCallback(
    async (cardId: string) => {
      if (!roomCode) throw new Error("Join a room first");
      console.log("[GameContext] revealCard (stub)", { roomCode, playerId, cardId });

      setRoomState((prev) => {
        if (!prev) throw new Error("Room not found");

        const currentPlayerData = prev.players.find((p) => p.id === playerId);
        if (!currentPlayerData || currentPlayerData.team !== prev.currentTeam) return prev;

        const target = prev.cards.find((c) => c.id === cardId);
        if (!target || target.revealed) return prev;

        const cards = prev.cards.map((c) => 
          c.id === cardId ? { ...c, revealed: true, revealedByTeam: prev.currentTeam } : c
        );

        const redCardsLeft =
          target.type === "red" ? Math.max(0, prev.redCardsLeft - 1) : prev.redCardsLeft;
        const blueCardsLeft =
          target.type === "blue" ? Math.max(0, prev.blueCardsLeft - 1) : prev.blueCardsLeft;

        const next: RoomState = { ...prev, cards, redCardsLeft, blueCardsLeft };
        return { ...next, winner: computeWinner(next) };
      });
    },
    [playerId, roomCode]
  );

  const sendHint = useCallback(
    async (word: string, number: number) => {
      if (!roomCode) throw new Error("Join a room first");
      const trimmed = word.trim();
      if (!trimmed) throw new Error("Hint word is required");

      console.log("[GameContext] sendHint (stub)", { roomCode, playerId, trimmed, number });

      setRoomState((prev) => {
        if (!prev) throw new Error("Room not found");
        const hint = { word: trimmed, number, team: prev.currentTeam };
        return {
          ...prev,
          currentHint: hint,
          hintHistory: [hint, ...prev.hintHistory],
        };
      });
    },
    [playerId, roomCode]
  );

  const endTurn = useCallback(async () => {
    if (!roomCode) throw new Error("Join a room first");
    console.log("[GameContext] endTurn (stub)", { roomCode, playerId });

    setRoomState((prev) => {
      if (!prev) throw new Error("Room not found");
      const nextTeam: Team = prev.currentTeam === "red" ? "blue" : "red";
      return { ...prev, currentTeam: nextTeam, currentHint: null };
    });
  }, [playerId, roomCode]);

  const resetGame = useCallback(async () => {
    if (!roomCode) throw new Error("Join a room first");
    console.log("[GameContext] resetGame (stub)", { roomCode, playerId });

    setRoomState((prev) => {
      if (!prev) throw new Error("Room not found");
      const deck = buildNewDeck();
      const next: RoomState = {
        ...prev,
        cards: deck.cards,
        redCardsLeft: deck.redCardsLeft,
        blueCardsLeft: deck.blueCardsLeft,
        winner: null,
        currentTeam: "red",
        currentHint: null,
        hintHistory: [],
        gameStarted: true,
      };
      return next;
    });
  }, [playerId, roomCode]);

  const toggleMic = useCallback(async () => {
    if (!roomCode) throw new Error("Join a room first");
    console.log("[GameContext] toggleMic (stub)", { roomCode, playerId });

    setRoomState((prev) => {
      if (!prev) throw new Error("Room not found");
      const nextPlayers = prev.players.map((p) =>
        p.id === playerId ? { ...p, micMuted: !p.micMuted } : p
      );
      return { ...prev, players: nextPlayers };
    });
  }, [playerId, roomCode]);

  const leaveRoom = useCallback(() => {
    console.log("[GameContext] leaveRoom (stub)", { roomCode, playerId });
    setRoomCode(null);
    setPlayerName("");
    setRoomState(null);
  }, [playerId, roomCode]);

  return {
    playerId,
    playerName,
    roomCode,
    roomState,
    currentPlayer,
    isRoomLoading: false,
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
  };
});
