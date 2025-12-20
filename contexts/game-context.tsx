import { useCallback, useEffect, useMemo, useState } from "react";
import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "@/backend/trpc/app-router";
import type { Player, Role, RoomState, Team } from "@/types/game";

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
}

const CLIENT_ID_STORAGE_KEY = "somali-codenames.clientId" as const;
const ROOM_CODE_STORAGE_KEY = "somali-codenames.roomCode" as const;

const generateClientId = (): string => {
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
};

const getApiUrl = (): string => {
  const envUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  if (envUrl) {
    console.log("[GameContext] Using env API URL:", envUrl);
    return envUrl;
  }
  console.log("[GameContext] Using localhost API URL");
  return "http://localhost:3000";
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

export const [GameProvider, useGame] = createContextHook<GameContextValue>(() => {
  const [playerId, setPlayerId] = useState<string>("");
  const [playerName, setPlayerName] = useState<string>("");
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [isRoomLoading, setIsRoomLoading] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  const trpcClient = useMemo(() => {
    const apiUrl = getApiUrl();
    const trpcUrl = `${apiUrl}/trpc`;
    console.log("[GameContext] Full tRPC URL:", trpcUrl);
    return createTRPCProxyClient<AppRouter>({
      links: [
        httpBatchLink({
          url: trpcUrl,
          transformer: superjson,
          fetch: async (url, options) => {
            console.log("[tRPC] Fetching:", url);
            try {
              const response = await fetch(url, options);
              console.log("[tRPC] Response status:", response.status);
              console.log("[tRPC] Response headers:", Object.fromEntries(response.headers.entries()));
              
              const contentType = response.headers.get("content-type");
              if (response.status === 404) {
                const text = await response.text();
                console.error("[tRPC] 404 Response body:", text.substring(0, 200));
                throw new Error(`API endpoint not found (404). Check that the Netlify function is deployed. URL: ${url}`);
              }
              
              if (!contentType?.includes("application/json")) {
                const text = await response.text();
                console.error("[tRPC] Non-JSON response:", text.substring(0, 200));
                throw new Error(`Expected JSON response but got ${contentType}. Response: ${text.substring(0, 100)}`);
              }
              
              return response;
            } catch (error) {
              console.error("[tRPC] Fetch error:", error);
              throw error;
            }
          },
        }),
      ],
    });
  }, []);

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

    return () => {
      cancelled = true;
    };
  }, []);

  const fetchSnapshot = useCallback(
    async (code: string) => {
      if (!code) return;
      console.log("[GameContext] fetchSnapshot", code);
      setIsRoomLoading(true);
      try {
        const room = await trpcClient.game.getRoomState.query({ roomCode: code });
        setRoomState(room);
      } catch (error) {
        console.error("[GameContext] fetchSnapshot error", error);
        setRoomState(null);
      } finally {
        setIsRoomLoading(false);
      }
    },
    [trpcClient]
  );

  useEffect(() => {
    if (!roomCode) {
      setRoomState(null);
      return;
    }

    void fetchSnapshot(roomCode);

    const interval = setInterval(() => {
      void fetchSnapshot(roomCode);
    }, 2000);

    return () => {
      clearInterval(interval);
    };
  }, [fetchSnapshot, roomCode]);

  const currentPlayer = useMemo(() => {
    if (!roomState || !playerId) return null;
    return roomState.players.find((p) => p.id === playerId) ?? null;
  }, [playerId, roomState]);

  const createRoom = useCallback(
    async (name: string) => {
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error("Name is required");
      if (!playerId) throw new Error("Player ID not ready");

      console.log("[GameContext] createRoom", { playerId, name: trimmedName });

      try {
        const result = await trpcClient.game.createRoom.mutate({
          playerId,
          playerName: trimmedName,
        });

        setPlayerName(trimmedName);
        setRoomCode(result.room.roomCode);
        await AsyncStorage.setItem(ROOM_CODE_STORAGE_KEY, result.room.roomCode);
        console.log("[GameContext] Room created:", result.room.roomCode);
      } catch (error) {
        console.error("[GameContext] createRoom error", error);
        throw error;
      }
    },
    [playerId, trpcClient]
  );

  const joinRoom = useCallback(
    async (name: string, code: string) => {
      const trimmedName = name.trim();
      const trimmedCode = code.trim().toUpperCase();
      if (!trimmedName || !trimmedCode) throw new Error("Name and room code are required");
      if (!playerId) throw new Error("Player ID not ready");

      console.log("[GameContext] joinRoom", { trimmedCode, playerId });

      try {
        await trpcClient.game.joinRoom.mutate({
          roomCode: trimmedCode,
          playerId,
          playerName: trimmedName,
        });

        setPlayerName(trimmedName);
        setRoomCode(trimmedCode);
        await AsyncStorage.setItem(ROOM_CODE_STORAGE_KEY, trimmedCode);
        console.log("[GameContext] Joined room:", trimmedCode);
      } catch (error) {
        console.error("[GameContext] joinRoom error", error);
        throw error;
      }
    },
    [playerId, trpcClient]
  );

  const selectTeam = useCallback(
    async (team: Team) => {
      if (!roomCode) throw new Error("Join a room first");
      if (!playerId) throw new Error("Player not ready");

      console.log("[GameContext] selectTeam", { roomCode, playerId, team });

      try {
        await trpcClient.game.selectTeam.mutate({
          roomCode,
          playerId,
          team,
        });
        await fetchSnapshot(roomCode);
      } catch (error) {
        console.error("[GameContext] selectTeam error", error);
        throw error;
      }
    },
    [playerId, roomCode, trpcClient, fetchSnapshot]
  );

  const setRole = useCallback(
    async (role: Role) => {
      if (!roomCode) throw new Error("Join a room first");
      if (!playerId) throw new Error("Player not ready");

      console.log("[GameContext] setRole", { roomCode, playerId, role });

      try {
        await trpcClient.game.setRole.mutate({
          roomCode,
          playerId,
          role,
        });
        await fetchSnapshot(roomCode);
      } catch (error) {
        console.error("[GameContext] setRole error", error);
        throw error;
      }
    },
    [playerId, roomCode, trpcClient, fetchSnapshot]
  );

  const sendHint = useCallback(
    async (word: string, number: number) => {
      if (!roomCode) throw new Error("Join a room first");
      if (!playerId) throw new Error("Player not ready");

      const trimmed = word.trim();
      if (!trimmed) throw new Error("Hint word is required");

      console.log("[GameContext] sendHint", { roomCode, playerId, word: trimmed, number });

      try {
        await trpcClient.game.sendHint.mutate({
          roomCode,
          playerId,
          word: trimmed,
          number,
        });
        await fetchSnapshot(roomCode);
      } catch (error) {
        console.error("[GameContext] sendHint error", error);
        throw error;
      }
    },
    [playerId, roomCode, trpcClient, fetchSnapshot]
  );

  const endTurn = useCallback(async () => {
    if (!roomCode) throw new Error("Join a room first");
    if (!playerId) throw new Error("Player not ready");

    console.log("[GameContext] endTurn", { roomCode, playerId });

    try {
      await trpcClient.game.endTurn.mutate({
        roomCode,
        playerId,
      });
      await fetchSnapshot(roomCode);
    } catch (error) {
      console.error("[GameContext] endTurn error", error);
      throw error;
    }
  }, [roomCode, playerId, trpcClient, fetchSnapshot]);

  const revealCard = useCallback(
    async (cardId: string) => {
      if (!roomCode) throw new Error("Join a room first");
      if (!playerId) throw new Error("Player not ready");

      console.log("[GameContext] revealCard", { roomCode, playerId, cardId });

      setRoomState((prev) => {
        if (!prev) return prev;
        const nextCards = prev.cards.map((c) => (c.id === cardId ? { ...c, revealed: true } : c));
        return { ...prev, cards: nextCards };
      });

      try {
        await trpcClient.game.revealCard.mutate({
          roomCode,
          playerId,
          cardId,
        });
        await fetchSnapshot(roomCode);
      } catch (error) {
        console.error("[GameContext] revealCard error", error);
        await fetchSnapshot(roomCode);
      }
    },
    [playerId, roomCode, trpcClient, fetchSnapshot]
  );

  const resetGame = useCallback(async () => {
    if (!roomCode) throw new Error("Join a room first");
    if (!playerId) throw new Error("Player not ready");

    console.log("[GameContext] resetGame", { roomCode, playerId });

    try {
      await trpcClient.game.resetGame.mutate({
        roomCode,
        playerId,
      });
      await fetchSnapshot(roomCode);
    } catch (error) {
      console.error("[GameContext] resetGame error", error);
      throw error;
    }
  }, [roomCode, playerId, trpcClient, fetchSnapshot]);

  const toggleMic = useCallback(async () => {
    if (!roomCode) throw new Error("Join a room first");
    if (!playerId) throw new Error("Player not ready");

    console.log("[GameContext] toggleMic", { roomCode, playerId });

    try {
      await trpcClient.game.toggleMic.mutate({
        roomCode,
        playerId,
      });
      await fetchSnapshot(roomCode);
    } catch (error) {
      console.error("[GameContext] toggleMic error", error);
    }
  }, [roomCode, playerId, trpcClient, fetchSnapshot]);

  const leaveRoom = useCallback(() => {
    console.log("[GameContext] leaveRoom", { roomCode });

    setRoomCode(null);
    setRoomState(null);
    setPlayerName("");
    void AsyncStorage.removeItem(ROOM_CODE_STORAGE_KEY);
  }, [roomCode]);

  const refetchRoom = useCallback(async () => {
    if (roomCode) {
      await fetchSnapshot(roomCode);
    }
  }, [roomCode, fetchSnapshot]);

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
  };
});
