export type Team = 'red' | 'blue';

export type CardType = 'red' | 'blue' | 'neutral' | 'assassin';

export interface Card {
  id: string;
  word: string;
  type: CardType;
  revealed: boolean;
  revealedByTeam: Team | null;
}

export interface Hint {
  word: string;
  number: number;
  team: Team;
}

export type TurnStatus = 'WAITING_HINT' | 'GUESSING';

export interface TurnState {
  turnTeam: Team;
  status: TurnStatus;
  hintWord: string | null;
  hintNumber: number | null;
  guessesLeft: number;
}

export interface GameState {
  cards: Card[];
  currentTeam: Team;
  redCardsLeft: number;
  blueCardsLeft: number;
  winner: Team | 'assassinated' | null;
  gameStarted: boolean;
  currentHint: Hint | null;
  hintHistory: Hint[];
  turn: TurnState;
  version: number;
}

export type Role = 'spymaster' | 'guesser';

export interface Player {
  id: string;
  name: string;
  team: Team | null;
  role: Role;
  micMuted: boolean;
}

export interface RoomState extends GameState {
  roomCode: string;
  players: Player[];
  redSpymasterId: string | null;
  blueSpymasterId: string | null;
}
