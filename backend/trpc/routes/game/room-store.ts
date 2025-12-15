import { SOMALI_WORDS } from "@/constants/somali-words";
import type {
  Card,
  CardType,
  GameState,
  Hint,
  Player,
  Role,
  RoomState,
  Team,
} from "@/types/game";

const GRID_SIZE = 25;
const RED_CARDS = 9;
const BLUE_CARDS = 8;
const NEUTRAL_CARDS = 7;
const ASSASSIN_CARDS = 1;

const rooms = new Map<string, RoomState>();

const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const createNewGameState = (): GameState => {
  const selectedWords = shuffleArray(SOMALI_WORDS).slice(0, GRID_SIZE);
  const types: CardType[] = [
    ...Array(RED_CARDS).fill("red" as CardType),
    ...Array(BLUE_CARDS).fill("blue" as CardType),
    ...Array(NEUTRAL_CARDS).fill("neutral" as CardType),
    ...Array(ASSASSIN_CARDS).fill("assassin" as CardType),
  ];
  const shuffledTypes = shuffleArray(types);

  const timestamp = Date.now();
  const cards: Card[] = selectedWords.map((word, index) => ({
    id: `card-${timestamp}-${index}`,
    word,
    type: shuffledTypes[index],
    revealed: false,
    revealedByTeam: null,
  }));

  return {
    cards,
    currentTeam: "red",
    redCardsLeft: RED_CARDS,
    blueCardsLeft: BLUE_CARDS,
    winner: null,
    gameStarted: true,
    currentHint: null,
    hintHistory: [],
  };
};

const generateRoomCode = (): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};

const createPlayer = (id: string, name: string): Player => ({
  id,
  name,
  team: null,
  role: "guesser",
  micMuted: false,
});

const ensureRoom = (roomCode: string): RoomState => {
  const room = rooms.get(roomCode.toUpperCase());
  if (!room) {
    throw new Error("Room not found");
  }
  return room;
};

const ensurePlayer = (room: RoomState, playerId: string): Player => {
  const player = room.players.find((p) => p.id === playerId);
  if (!player) {
    throw new Error("Player not found in this room");
  }
  return player;
};

const updateHintHistory = (room: RoomState, hint: Hint) => {
  room.currentHint = hint;
  room.hintHistory = [hint, ...room.hintHistory].slice(0, 3);
};

const resetRoomGameState = (room: RoomState) => {
  const nextGame = createNewGameState();
  room.cards = nextGame.cards;
  room.currentTeam = nextGame.currentTeam;
  room.redCardsLeft = nextGame.redCardsLeft;
  room.blueCardsLeft = nextGame.blueCardsLeft;
  room.winner = nextGame.winner;
  room.currentHint = nextGame.currentHint;
  room.hintHistory = nextGame.hintHistory;
  room.gameStarted = nextGame.gameStarted;
};

export const roomStore = {
  createRoom: ({
    playerId,
    playerName,
  }: {
    playerId: string;
    playerName: string;
  }) => {
    let roomCode = generateRoomCode();
    while (rooms.has(roomCode)) {
      roomCode = generateRoomCode();
    }

    const baseGame = createNewGameState();
    const room: RoomState = {
      ...baseGame,
      roomCode,
      players: [],
      redSpymasterId: null,
      blueSpymasterId: null,
    };

    const player = createPlayer(playerId, playerName.trim());
    room.players.push(player);
    rooms.set(roomCode, room);

    return { room, player };
  },
  joinRoom: ({
    roomCode,
    playerId,
    playerName,
  }: {
    roomCode: string;
    playerId: string;
    playerName: string;
  }) => {
    const room = ensureRoom(roomCode);
    const existingPlayer = room.players.find((p) => p.id === playerId);
    if (existingPlayer) {
      existingPlayer.name = playerName.trim();
      return { room, player: existingPlayer };
    }

    const newPlayer = createPlayer(playerId, playerName.trim());
    room.players.push(newPlayer);
    rooms.set(room.roomCode, room);
    return { room, player: newPlayer };
  },
  selectTeam: ({
    roomCode,
    playerId,
    team,
  }: {
    roomCode: string;
    playerId: string;
    team: Team;
  }) => {
    const room = ensureRoom(roomCode);
    const player = ensurePlayer(room, playerId);
    player.team = team;
    rooms.set(room.roomCode, room);
    return room;
  },
  setRole: ({
    roomCode,
    playerId,
    role,
  }: {
    roomCode: string;
    playerId: string;
    role: Role;
  }) => {
    const room = ensureRoom(roomCode);
    const player = ensurePlayer(room, playerId);

    if (!player.team) {
      throw new Error("Select a team before choosing a role");
    }

    const teamSpymasterKey = player.team === "red" ? "redSpymasterId" : "blueSpymasterId";
    const currentSpymaster = room[teamSpymasterKey];

    if (role === "spymaster") {
      if (currentSpymaster && currentSpymaster !== playerId) {
        const formerSpymaster = room.players.find((p) => p.id === currentSpymaster);
        if (formerSpymaster) {
          formerSpymaster.role = "guesser";
        }
      }
      room[teamSpymasterKey] = playerId;
      player.role = "spymaster";
    } else {
      if (currentSpymaster === playerId) {
        room[teamSpymasterKey] = null;
      }
      player.role = role;
    }

    rooms.set(room.roomCode, room);
    return { room, replacedSpymaster: role === "spymaster" && currentSpymaster && currentSpymaster !== playerId };
  },
  revealCard: ({
    roomCode,
    playerId,
    cardId,
  }: {
    roomCode: string;
    playerId: string;
    cardId: string;
  }) => {
    const room = ensureRoom(roomCode);
    const player = ensurePlayer(room, playerId);

    if (player.role !== "guesser") {
      throw new Error("Only guessers can reveal cards");
    }
    if (player.team !== room.currentTeam) {
      throw new Error("It is not your team's turn");
    }

    const cardIndex = room.cards.findIndex((card) => card.id === cardId);
    if (cardIndex === -1) {
      throw new Error("Card not found");
    }

    const card = room.cards[cardIndex];
    if (card.revealed) {
      return room;
    }

    card.revealed = true;
    card.revealedByTeam = room.currentTeam;

    if (card.type === "assassin") {
      room.winner = "assassinated";
    } else if (card.type === "red") {
      room.redCardsLeft -= 1;
      if (room.redCardsLeft === 0) {
        room.winner = "red";
      }
    } else if (card.type === "blue") {
      room.blueCardsLeft -= 1;
      if (room.blueCardsLeft === 0) {
        room.winner = "blue";
      }
    }

    if (room.winner) {
      rooms.set(room.roomCode, room);
      return room;
    }

    if (card.type === "neutral") {
      room.currentTeam = room.currentTeam === "red" ? "blue" : "red";
    } else if (card.type === "red" && room.currentTeam === "blue") {
      room.currentTeam = "red";
    } else if (card.type === "blue" && room.currentTeam === "red") {
      room.currentTeam = "blue";
    }

    rooms.set(room.roomCode, room);
    return room;
  },
  sendHint: ({
    roomCode,
    playerId,
    word,
    number,
  }: {
    roomCode: string;
    playerId: string;
    word: string;
    number: number;
  }) => {
    const room = ensureRoom(roomCode);
    ensurePlayer(room, playerId);
    const teamSpymasterKey = room.currentTeam === "red" ? "redSpymasterId" : "blueSpymasterId";
    
    if (room[teamSpymasterKey] !== playerId) {
      throw new Error("Only the current team's Spymaster can send hints");
    }

    const hint: Hint = {
      word,
      number,
      team: room.currentTeam,
    };

    updateHintHistory(room, hint);
    rooms.set(room.roomCode, room);
    return room;
  },
  endTurn: ({ roomCode, playerId }: { roomCode: string; playerId: string }) => {
    const room = ensureRoom(roomCode);
    const teamSpymasterKey = room.currentTeam === "red" ? "redSpymasterId" : "blueSpymasterId";
    
    if (room[teamSpymasterKey] !== playerId) {
      throw new Error("Only the current team's Spymaster can end the turn");
    }
    room.currentTeam = room.currentTeam === "red" ? "blue" : "red";
    room.currentHint = null;
    rooms.set(room.roomCode, room);
    return room;
  },
  resetGame: ({ roomCode, playerId }: { roomCode: string; playerId: string }) => {
    const room = ensureRoom(roomCode);
    const player = ensurePlayer(room, playerId);
    const teamSpymasterKey = player.team === "red" ? "redSpymasterId" : "blueSpymasterId";
    
    if (room[teamSpymasterKey] !== playerId) {
      throw new Error("Only a Spymaster can reset the game");
    }
    resetRoomGameState(room);
    rooms.set(room.roomCode, room);
    return room;
  },
  toggleMic: ({ roomCode, playerId }: { roomCode: string; playerId: string }) => {
    const room = ensureRoom(roomCode);
    const player = ensurePlayer(room, playerId);
    player.micMuted = !player.micMuted;
    rooms.set(room.roomCode, room);
    return room;
  },
  getRoomState: (roomCode: string) => ensureRoom(roomCode),
};
