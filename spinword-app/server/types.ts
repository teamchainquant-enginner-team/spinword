export type VirtualCurrency = "LOOT_COIN" | "SPIN_COIN";
export type GameMode = "STANDARD" | "MAX";
export type TileState = "correct" | "present" | "absent";
export type RoundStatus = "ACTIVE" | "SETTLED" | "VOIDED" | "EXPIRED";

export type Paytable = Readonly<[number, number, number, number, number, number]>;

export type PublicGuess = {
  guessNumber: number;
  word: string;
  result: TileState[];
  submittedAt: string;
};

export type PublicRound = {
  id: string;
  publicRef: string;
  mode: GameMode;
  currency: VirtualCurrency;
  playAmountMinor: number;
  status: RoundStatus;
  outcome: "WON" | "LOST" | null;
  paytableVersion: string;
  paytable: Paytable;
  wordPoolVersion: string;
  serverSeedHash: string;
  revealedServerSeed: string | null;
  clientSeed: string;
  nonce: number;
  guessesUsed: number;
  multiplierBasisPoints: number | null;
  payoutAmountMinor: number | null;
  answer: string | null;
  verificationStatus: string;
  createdAt: string;
  settledAt: string | null;
  guesses: PublicGuess[];
};

export class DomainError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
  }
}
