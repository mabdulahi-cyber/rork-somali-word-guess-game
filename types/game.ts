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

export interface GameState {
  cards: Card[];
  currentTeam: Team;
  redCardsLeft: number;
  blueCardsLeft: number;
  winner: Team | 'assassinated' | null;
  gameStarted: boolean;
  currentHint: Hint | null;
  hintHistory: Hint[];
}

export type Role = 'scrumMaster' | 'guesser';

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
  scrumMasterId: string | null;
}
