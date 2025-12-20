import { useCallback, useEffect, useMemo, useState } from "react";
import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { SOMALI_WORDS } from "@/constants/somali-words";
import type { Card, CardType, Hint, Player, Role, RoomState, Team, TurnStatus } from "@/types/game";

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

const CLIENT_ID_STORAGE_KEY = "somali-codenames.clientId" as const;

const generateClientId = (): string => {
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
};

const generateRoomCode = (): string => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
};

const shuffle = <T,>(arr: T[]): T[] => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
};

type DbTeam = "RED" | "BLUE";
type DbRole = "SPYMASTER" | "GUESSER";
type DbGameStatus = "LOBBY" | "PLAYING" | "ENDED";
type DbTurnStatus = "WAITING_HINT" | "GUESSING";
type DbKey = "RED" | "BLUE" | "NEUTRAL" | "ASSASSIN";

type DbRoomRow = {
  code: string;
  created_at: string;
  game_status: DbGameStatus;
  turn_team: DbTeam;
  turn_status: DbTurnStatus;
  hint_word: string | null;
  hint_number: number | null;
  guesses_left: number;
  words: unknown;
  key_map: unknown;
  revealed: unknown;
  version: number;
};

type DbPlayerRow = {
  id: string;
  room_code: string;
  name: string;
  team: DbTeam | null;
  role: DbRole;
  joined_at: string;
  is_active: boolean;
  client_id?: string | null;
};

const toTeam = (team: DbTeam | null): Team | null => {
  if (team === "RED") return "red";
  if (team === "BLUE") return "blue";
  return null;
};

const toDbTeam = (team: Team): DbTeam => (team === "red" ? "RED" : "BLUE");

const toRole = (role: DbRole): Role => (role === "SPYMASTER" ? "spymaster" : "guesser");

const otherTeam = (team: Team): Team => (team === "red" ? "blue" : "red");

const parseJsonArray = <T,>(value: unknown, fallback: T[]): T[] => {
  if (Array.isArray(value)) return value as T[];
  return fallback;
};

const toCardType = (key: DbKey): CardType => {
  switch (key) {
    case "RED":
      return "red";
    case "BLUE":
      return "blue";
    case "NEUTRAL":
      return "neutral";
    case "ASSASSIN":
      return "assassin";
  }
};

const computeCounts = (keyMap: DbKey[], revealed: boolean[]) => {
  let redLeft = 0;
  let blueLeft = 0;

  for (let i = 0; i < keyMap.length; i += 1) {
    if (revealed[i]) continue;
    if (keyMap[i] === "RED") redLeft += 1;
    if (keyMap[i] === "BLUE") blueLeft += 1;
  }

  const assassinRevealed = keyMap.some((k, i) => k === "ASSASSIN" && revealed[i]);

  return { redLeft, blueLeft, assassinRevealed };
};

const dbToRoomState = (room: DbRoomRow, players: DbPlayerRow[]): RoomState => {
  const words = parseJsonArray<string>(room.words, []);
  const keyMap = parseJsonArray<DbKey>(room.key_map, []);
  const revealed = parseJsonArray<boolean>(room.revealed, []);

  const cards: Card[] = words.map((word, index) => ({
    id: `card-${index}`,
    word,
    type: toCardType(keyMap[index]),
    revealed: Boolean(revealed[index]),
    revealedByTeam: null,
  }));

  const mappedPlayers: Player[] = players
    .filter((p) => p.is_active)
    .sort((a, b) => (a.joined_at < b.joined_at ? -1 : 1))
    .map((p) => ({
      id: p.id,
      name: p.name,
      team: toTeam(p.team),
      role: toRole(p.role),
      micMuted: false,
    }));

  const redSpymasterId = players.find((p) => p.is_active && p.team === "RED" && p.role === "SPYMASTER")?.id ?? null;
  const blueSpymasterId = players.find((p) => p.is_active && p.team === "BLUE" && p.role === "SPYMASTER")?.id ?? null;

  const turnTeam = toTeam(room.turn_team) ?? "red";
  const { redLeft, blueLeft, assassinRevealed } = computeCounts(keyMap, revealed);

  const winner: RoomState["winner"] =
    room.game_status === "ENDED"
      ? redLeft === 0
        ? "red"
        : blueLeft === 0
          ? "blue"
          : assassinRevealed
            ? "assassinated"
            : null
      : null;

  const currentHint: Hint | null =
    room.hint_word && typeof room.hint_number === "number"
      ? { word: room.hint_word, number: room.hint_number, team: turnTeam }
      : null;

  const turnStatus: TurnStatus = room.turn_status;

  return {
    roomCode: room.code,
    cards,
    players: mappedPlayers,
    currentTeam: turnTeam,
    redCardsLeft: redLeft,
    blueCardsLeft: blueLeft,
    winner,
    gameStarted: room.game_status !== "LOBBY",
    currentHint,
    hintHistory: [],
    turn: {
      turnTeam,
      status: turnStatus,
      hintWord: room.hint_word,
      hintNumber: room.hint_number,
      guessesLeft: room.guesses_left,
    },
    version: room.version,
    lastEvent: null,
    redSpymasterId,
    blueSpymasterId,
  };
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

const createKeyMap = (startingTeam: DbTeam): DbKey[] => {
  const isRedStart = startingTeam === "RED";
  const reds = isRedStart ? 9 : 8;
  const blues = isRedStart ? 8 : 9;
  const neutrals = 7;
  const assassin = 1;

  const keys: DbKey[] = [
    ...Array.from({ length: reds }, () => "RED" as const),
    ...Array.from({ length: blues }, () => "BLUE" as const),
    ...Array.from({ length: neutrals }, () => "NEUTRAL" as const),
    ...Array.from({ length: assassin }, () => "ASSASSIN" as const),
  ];

  return shuffle(keys);
};

export const [GameProvider, useGame] = createContextHook<GameContextValue>(() => {
  const [clientId, setClientId] = useState<string>("");
  const [playerId, setPlayerId] = useState<string>("");
  const [playerName, setPlayerName] = useState<string>("");
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [isRoomLoading, setIsRoomLoading] = useState<boolean>(false);


  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const id = await tryLoadClientId();
      if (cancelled) return;
      setClientId(id);
      console.log("[GameContext] clientId", id);
    };
    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  const fetchSnapshot = useCallback(
    async (code: string) => {
      console.log("[GameContext] fetchSnapshot", code);
      setIsRoomLoading(true);
      try {
        const roomRes = await supabase.from("rooms").select("*").eq("code", code).single<DbRoomRow>();
        if (roomRes.error || !roomRes.data) {
          console.error("[GameContext] fetchSnapshot room error", roomRes.error);
          throw new Error(roomRes.error?.message ?? "Room not found");
        }

        const playersRes = await supabase
          .from("players")
          .select("*")
          .eq("room_code", code)
          .order("joined_at", { ascending: true })
          .returns<DbPlayerRow[]>();

        if (playersRes.error) {
          console.error("[GameContext] fetchSnapshot players error", playersRes.error);
          throw new Error(playersRes.error.message);
        }

        const state = dbToRoomState(roomRes.data, playersRes.data ?? []);
        setRoomState(state);
      } finally {
        setIsRoomLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const code = roomCode;
    if (!code) {
      setRoomState(null);
      return;
    }

    void fetchSnapshot(code);

    const roomsChannelName = `rooms-${code}`;
    const playersChannelName = `players-${code}`;

    console.log("[GameContext] Subscribing", { roomsChannelName, playersChannelName });

    const roomsChannel = supabase
      .channel(roomsChannelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `code=eq.${code}` },
        (payload) => {
          console.log("[Realtime] rooms change", payload.eventType);
          void fetchSnapshot(code);
        }
      )
      .subscribe((status) => {
        console.log("[Realtime] rooms subscribe", status);
      });

    const playersChannel = supabase
      .channel(playersChannelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `room_code=eq.${code}` },
        (payload) => {
          console.log("[Realtime] players change", payload.eventType);
          void fetchSnapshot(code);
        }
      )
      .subscribe((status) => {
        console.log("[Realtime] players subscribe", status);
      });

    const cleanupChannels = { roomsChannel, playersChannel };

    return () => {
      console.log("[GameContext] Unsubscribing", { roomsChannelName, playersChannelName });
      void supabase.removeChannel(cleanupChannels.roomsChannel);
      void supabase.removeChannel(cleanupChannels.playersChannel);
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

      const code = generateRoomCode();
      const startingTeam: DbTeam = "RED";
      const words = shuffle(SOMALI_WORDS).slice(0, 25);
      const keyMap = createKeyMap(startingTeam);
      const revealed = Array.from({ length: 25 }, () => false);

      console.log("[GameContext] createRoom", { code, clientId });

      const insertRoom = await supabase.from("rooms").insert({
        code,
        game_status: "LOBBY" as const,
        turn_team: startingTeam,
        turn_status: "WAITING_HINT" as const,
        hint_word: null,
        hint_number: null,
        guesses_left: 0,
        words,
        key_map: keyMap,
        revealed,
        version: 0,
      });

      if (insertRoom.error) {
        console.error("[GameContext] createRoom insert room error", insertRoom.error);
        throw new Error(insertRoom.error.message);
      }

      const insertPlayer = await supabase
        .from("players")
        .insert({
          room_code: code,
          name: trimmedName,
          team: null,
          role: "GUESSER" as const,
          is_active: true,
          client_id: clientId || null,
        })
        .select("*")
        .single<DbPlayerRow>();

      if (insertPlayer.error || !insertPlayer.data) {
        console.error("[GameContext] createRoom insert player error", insertPlayer.error);
        throw new Error(insertPlayer.error?.message ?? "Failed to create player");
      }

      setPlayerId(insertPlayer.data.id);
      setPlayerName(trimmedName);
      setRoomCode(code);
    },
    [clientId]
  );

  const joinRoom = useCallback(
    async (name: string, code: string) => {
      const trimmedName = name.trim();
      const trimmedCode = code.trim().toUpperCase();
      if (!trimmedName || !trimmedCode) throw new Error("Name and room code are required");

      console.log("[GameContext] joinRoom", { trimmedCode, clientId });

      const roomRes = await supabase.from("rooms").select("code").eq("code", trimmedCode).maybeSingle();
      if (roomRes.error) {
        console.error("[GameContext] joinRoom fetch room error", roomRes.error);
        throw new Error(roomRes.error.message);
      }
      if (!roomRes.data) {
        throw new Error("Room not found");
      }

      const insertPlayer = await supabase
        .from("players")
        .insert({
          room_code: trimmedCode,
          name: trimmedName,
          team: null,
          role: "GUESSER" as const,
          is_active: true,
          client_id: clientId || null,
        })
        .select("*")
        .single<DbPlayerRow>();

      if (insertPlayer.error || !insertPlayer.data) {
        console.error("[GameContext] joinRoom insert player error", insertPlayer.error);
        throw new Error(insertPlayer.error?.message ?? "Failed to join room");
      }

      setPlayerId(insertPlayer.data.id);
      setPlayerName(trimmedName);
      setRoomCode(trimmedCode);
    },
    [clientId]
  );

  const selectTeam = useCallback(
    async (team: Team) => {
      if (!roomCode) throw new Error("Join a room first");
      if (!playerId) throw new Error("Player not ready");

      console.log("[GameContext] selectTeam", { roomCode, playerId, team });

      const res = await supabase
        .from("players")
        .update({ team: toDbTeam(team) })
        .eq("id", playerId)
        .eq("room_code", roomCode);

      if (res.error) {
        console.error("[GameContext] selectTeam error", res.error);
        throw new Error(res.error.message);
      }
    },
    [playerId, roomCode]
  );

  const setRole = useCallback(
    async (role: Role) => {
      if (!roomCode) throw new Error("Join a room first");
      if (!playerId) throw new Error("Player not ready");

      const state = roomState;
      const me = currentPlayer;

      if (!state || !me || !me.team) {
        throw new Error("Pick a team first");
      }

      console.log("[GameContext] setRole", { roomCode, playerId, role, team: me.team });

      if (role === "guesser") {
        const res = await supabase
          .from("players")
          .update({ role: "GUESSER" as const })
          .eq("id", playerId)
          .eq("room_code", roomCode);

        if (res.error) {
          console.error("[GameContext] setRole guesser error", res.error);
          throw new Error(res.error.message);
        }
        return;
      }

      const teamDb = toDbTeam(me.team);
      const existingSpy = state.players.find((p) => p.team === me.team && p.role === "spymaster" && p.id !== playerId);

      if (existingSpy) {
        console.log("[GameContext] replacing spymaster", existingSpy.id);
        const demote = await supabase
          .from("players")
          .update({ role: "GUESSER" as const })
          .eq("id", existingSpy.id)
          .eq("room_code", roomCode);

        if (demote.error) {
          console.error("[GameContext] demote error", demote.error);
          throw new Error(demote.error.message);
        }
      }

      const promote = await supabase
        .from("players")
        .update({ role: "SPYMASTER" as const, team: teamDb })
        .eq("id", playerId)
        .eq("room_code", roomCode);

      if (promote.error) {
        console.error("[GameContext] promote error", promote.error);
        throw new Error(promote.error.message);
      }
    },
    [currentPlayer, playerId, roomCode, roomState]
  );

  const sendHint = useCallback(
    async (word: string, number: number) => {
      if (!roomCode) throw new Error("Join a room first");
      if (!playerId) throw new Error("Player not ready");

      const trimmed = word.trim();
      if (!trimmed) throw new Error("Hint word is required");
      if (!roomState || !currentPlayer?.team) throw new Error("Room not ready");

      if (currentPlayer.role !== "spymaster") throw new Error("Only the Spymaster can send hints");
      if (roomState.turn.turnTeam !== currentPlayer.team) throw new Error("It is not your team's turn");
      if (roomState.turn.status !== "WAITING_HINT") throw new Error("A hint has already been given");

      console.log("[GameContext] sendHint", { roomCode, playerId, trimmed, number });

      const res = await supabase
        .from("rooms")
        .update({
          game_status: "PLAYING" as const,
          turn_status: "GUESSING" as const,
          hint_word: trimmed,
          hint_number: number,
          guesses_left: number + 1,
          version: (roomState.version ?? 0) + 1,
        })
        .eq("code", roomCode);

      if (res.error) {
        console.error("[GameContext] sendHint error", res.error);
        throw new Error(res.error.message);
      }
    },
    [currentPlayer, playerId, roomCode, roomState]
  );

  const endTurn = useCallback(async () => {
    if (!roomCode) throw new Error("Join a room first");
    if (!roomState) throw new Error("Room not ready");

    const nextTeam = otherTeam(roomState.turn.turnTeam);

    console.log("[GameContext] endTurn", { roomCode, nextTeam });

    const res = await supabase
      .from("rooms")
      .update({
        turn_team: toDbTeam(nextTeam),
        turn_status: "WAITING_HINT" as const,
        hint_word: null,
        hint_number: null,
        guesses_left: 0,
        version: (roomState.version ?? 0) + 1,
      })
      .eq("code", roomCode);

    if (res.error) {
      console.error("[GameContext] endTurn error", res.error);
      throw new Error(res.error.message);
    }
  }, [roomCode, roomState]);

  const revealCard = useCallback(
    async (cardId: string) => {
      if (!roomCode) throw new Error("Join a room first");
      if (!playerId) throw new Error("Player not ready");

      const state = roomState;
      const me = currentPlayer;

      if (!state || !me || !me.team) throw new Error("Room not ready");

      if (state.winner) return;
      if (state.turn.status !== "GUESSING") return;
      if (me.role !== "guesser") return;
      if (me.team !== state.turn.turnTeam) return;

      const match = /^card-(\d+)$/.exec(cardId);
      const index = match ? Number(match[1]) : NaN;
      if (!Number.isFinite(index)) return;

      console.log("[GameContext] revealCard", { roomCode, playerId, index });

      // Optimistic UI: flip locally immediately
      setRoomState((prev) => {
        if (!prev) return prev;
        const nextCards = prev.cards.map((c) => (c.id === cardId ? { ...c, revealed: true } : c));
        return { ...prev, cards: nextCards };
      });

      // Fetch latest from DB so we use canonical key_map + revealed + version
      const roomRes = await supabase.from("rooms").select("*").eq("code", roomCode).single<DbRoomRow>();
      if (roomRes.error || !roomRes.data) {
        console.error("[GameContext] revealCard fetch room error", roomRes.error);
        await fetchSnapshot(roomCode);
        return;
      }

      const words = parseJsonArray<string>(roomRes.data.words, []);
      const keyMap = parseJsonArray<DbKey>(roomRes.data.key_map, []);
      const revealed = parseJsonArray<boolean>(roomRes.data.revealed, []);

      if (revealed[index]) {
        console.log("[GameContext] revealCard already revealed - ignore", { index });
        await fetchSnapshot(roomCode);
        return;
      }

      const nextRevealed = [...revealed];
      nextRevealed[index] = true;

      const cardType = keyMap[index];

      const { redLeft, blueLeft } = computeCounts(keyMap, nextRevealed);
      const hitAssassin = cardType === "ASSASSIN";

      let nextGameStatus: DbGameStatus = roomRes.data.game_status;
      let nextTurnTeam: DbTeam = roomRes.data.turn_team;
      let nextTurnStatus: DbTurnStatus = roomRes.data.turn_status;
      let nextHintWord: string | null = roomRes.data.hint_word;
      let nextHintNumber: number | null = roomRes.data.hint_number;
      let nextGuessesLeft: number = roomRes.data.guesses_left;

      const endTurnNow = () => {
        const t = toTeam(nextTurnTeam) ?? "red";
        const other = otherTeam(t);
        nextTurnTeam = toDbTeam(other);
        nextTurnStatus = "WAITING_HINT";
        nextHintWord = null;
        nextHintNumber = null;
        nextGuessesLeft = 0;
      };

      if (hitAssassin) {
        nextGameStatus = "ENDED";
        endTurnNow();
      } else if (cardType === "NEUTRAL") {
        endTurnNow();
      } else {
        const guesserTeam = me.team;
        const guessedColor = cardType === "RED" ? "red" : "blue";
        if (guessedColor !== guesserTeam) {
          endTurnNow();
        } else {
          nextGuessesLeft = Math.max(0, nextGuessesLeft - 1);
          if (nextGuessesLeft === 0) {
            endTurnNow();
          }
        }
      }

      // Win condition
      if (redLeft === 0 || blueLeft === 0) {
        nextGameStatus = "ENDED";
      }

      // best-effort optimistic concurrency with version
      const updateRes = await supabase
        .from("rooms")
        .update({
          revealed: nextRevealed,
          game_status: nextGameStatus,
          turn_team: nextTurnTeam,
          turn_status: nextTurnStatus,
          hint_word: nextHintWord,
          hint_number: nextHintNumber,
          guesses_left: nextGuessesLeft,
          version: roomRes.data.version + 1,
          words,
          key_map: keyMap,
        })
        .eq("code", roomCode)
        .eq("version", roomRes.data.version);

      if (updateRes.error) {
        console.error("[GameContext] revealCard update error", updateRes.error);
      }

      await fetchSnapshot(roomCode);
    },
    [currentPlayer, fetchSnapshot, playerId, roomCode, roomState]
  );

  const resetGame = useCallback(async () => {
    if (!roomCode) throw new Error("Join a room first");

    const startingTeam: DbTeam = "RED";
    const words = shuffle(SOMALI_WORDS).slice(0, 25);
    const keyMap = createKeyMap(startingTeam);
    const revealed = Array.from({ length: 25 }, () => false);

    console.log("[GameContext] resetGame", { roomCode });

    const roomRes = await supabase.from("rooms").select("version").eq("code", roomCode).single();
    const currentVersion = (roomRes.data as { version?: number } | null)?.version ?? 0;

    const res = await supabase
      .from("rooms")
      .update({
        game_status: "LOBBY" as const,
        turn_team: startingTeam,
        turn_status: "WAITING_HINT" as const,
        hint_word: null,
        hint_number: null,
        guesses_left: 0,
        words,
        key_map: keyMap,
        revealed,
        version: currentVersion + 1,
      })
      .eq("code", roomCode);

    if (res.error) {
      console.error("[GameContext] resetGame error", res.error);
      throw new Error(res.error.message);
    }
  }, [roomCode]);

  const toggleMic = useCallback(async () => {
    // Mic state is local-only in this Supabase migration phase.
    console.log("[GameContext] toggleMic (noop)");
  }, []);

  const leaveRoom = useCallback(() => {
    console.log("[GameContext] leaveRoom", { roomCode, playerId });

    if (roomCode && playerId) {
      void supabase
        .from("players")
        .update({ is_active: false })
        .eq("room_code", roomCode)
        .eq("id", playerId);
    }

    setRoomCode(null);
    setRoomState(null);
    setPlayerId("");
    setPlayerName("");
  }, [playerId, roomCode]);

  return {
    playerId,
    playerName,
    roomCode,
    roomState,
    currentPlayer,
    isRoomLoading,
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
