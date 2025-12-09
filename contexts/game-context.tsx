import { useCallback, useMemo, useState } from "react";
import createContextHook from "@nkzw/create-context-hook";
import { trpc } from "@/lib/trpc";
import type { Player, Role, RoomState, Team } from "@/types/game";

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

export const [GameProvider, useGame] = createContextHook<GameContextValue>(() => {
  const [playerId] = useState<string>(() => generatePlayerId());
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string>("");

  const utils = trpc.useUtils();

  const normalizedRoomCode = roomCode?.toUpperCase() ?? "";

  const roomStateQuery = trpc.game.getRoomState.useQuery(
    { roomCode: normalizedRoomCode },
    {
      enabled: Boolean(roomCode),
      refetchInterval: 1000,
      refetchOnWindowFocus: true,
    }
  );

  const invalidateRoom = useCallback(
    async (code?: string) => {
      const target = (code ?? roomCode)?.toUpperCase();
      if (!target) return;
      await utils.game.getRoomState.invalidate({ roomCode: target });
    },
    [roomCode, utils]
  );

  const createRoomMutation = trpc.game.createRoom.useMutation();
  const joinRoomMutation = trpc.game.joinRoom.useMutation();
  const selectTeamMutation = trpc.game.selectTeam.useMutation();
  const setRoleMutation = trpc.game.setRole.useMutation();
  const revealCardMutation = trpc.game.revealCard.useMutation();
  const sendHintMutation = trpc.game.sendHint.useMutation();
  const endTurnMutation = trpc.game.endTurn.useMutation();
  const resetGameMutation = trpc.game.resetGame.useMutation();
  const toggleMicMutation = trpc.game.toggleMic.useMutation();

  const createRoom = useCallback(
    async (name: string) => {
      const trimmedName = name.trim();
      if (!trimmedName) {
        throw new Error("Name is required");
      }
      const response = await createRoomMutation.mutateAsync({
        playerId,
        playerName: trimmedName,
      });
      setRoomCode(response.room.roomCode);
      setPlayerName(response.player.name);
      await invalidateRoom(response.room.roomCode);
    },
    [createRoomMutation, invalidateRoom, playerId]
  );

  const joinRoom = useCallback(
    async (name: string, code: string) => {
      const trimmedName = name.trim();
      const trimmedCode = code.trim().toUpperCase();
      if (!trimmedName || !trimmedCode) {
        throw new Error("Name and room code are required");
      }
      const response = await joinRoomMutation.mutateAsync({
        playerId,
        playerName: trimmedName,
        roomCode: trimmedCode,
      });
      setRoomCode(response.room.roomCode);
      setPlayerName(response.player.name);
      await invalidateRoom(response.room.roomCode);
    },
    [invalidateRoom, joinRoomMutation, playerId]
  );

  const selectTeam = useCallback(
    async (team: Team) => {
      if (!roomCode) {
        throw new Error("Join a room first");
      }
      await selectTeamMutation.mutateAsync({
        roomCode,
        playerId,
        team,
      });
      await invalidateRoom();
    },
    [invalidateRoom, playerId, roomCode, selectTeamMutation]
  );

  const setRole = useCallback(
    async (role: Role) => {
      if (!roomCode) {
        throw new Error("Join a room first");
      }
      await setRoleMutation.mutateAsync({
        roomCode,
        playerId,
        role,
      });
      await invalidateRoom();
    },
    [invalidateRoom, playerId, roomCode, setRoleMutation]
  );

  const revealCard = useCallback(
    async (cardId: string) => {
      if (!roomCode) {
        throw new Error("Join a room first");
      }
      await revealCardMutation.mutateAsync({
        roomCode,
        playerId,
        cardId,
      });
      await invalidateRoom();
    },
    [invalidateRoom, playerId, revealCardMutation, roomCode]
  );

  const sendHint = useCallback(
    async (word: string, number: number) => {
      if (!roomCode) {
        throw new Error("Join a room first");
      }
      await sendHintMutation.mutateAsync({
        roomCode,
        playerId,
        word,
        number,
      });
      await invalidateRoom();
    },
    [invalidateRoom, playerId, roomCode, sendHintMutation]
  );

  const endTurn = useCallback(async () => {
    if (!roomCode) {
      throw new Error("Join a room first");
    }
    await endTurnMutation.mutateAsync({
      roomCode,
      playerId,
    });
    await invalidateRoom();
  }, [endTurnMutation, invalidateRoom, playerId, roomCode]);

  const resetGame = useCallback(async () => {
    if (!roomCode) {
      throw new Error("Join a room first");
    }
    await resetGameMutation.mutateAsync({
      roomCode,
      playerId,
    });
    await invalidateRoom();
  }, [invalidateRoom, playerId, resetGameMutation, roomCode]);

  const toggleMic = useCallback(async () => {
    if (!roomCode) {
      throw new Error("Join a room first");
    }
    await toggleMicMutation.mutateAsync({
      roomCode,
      playerId,
    });
    await invalidateRoom();
  }, [invalidateRoom, playerId, roomCode, toggleMicMutation]);

  const leaveRoom = useCallback(() => {
    setRoomCode(null);
    setPlayerName("");
  }, []);

  const currentPlayer = useMemo(() => {
    if (!roomStateQuery.data) return null;
    return roomStateQuery.data.players.find((player) => player.id === playerId) ?? null;
  }, [playerId, roomStateQuery.data]);

  return {
    playerId,
    playerName,
    roomCode,
    roomState: roomStateQuery.data ?? null,
    currentPlayer,
    isRoomLoading: roomStateQuery.isLoading || roomStateQuery.isFetching,
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
