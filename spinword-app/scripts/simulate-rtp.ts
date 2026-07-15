import fs from "node:fs";
import path from "node:path";
import { DEV_WORDS, PAYTABLES } from "../server/config";
import { calculateReturnMinor } from "../server/money";
import { scoreGuess } from "../server/fairness";

type Strategy = "ordered" | "frequency";
const roundsArg = process.argv.find((value) => value.startsWith("--rounds="));
const strategyArg = process.argv.find((value) => value.startsWith("--strategy="));
const rounds = Number(roundsArg?.split("=")[1] || 1_000_000);
const strategy = (strategyArg?.split("=")[1] || "frequency") as Strategy;
if (!Number.isInteger(rounds) || rounds < 1) throw new Error("--rounds must be a positive integer");
if (!["ordered", "frequency"].includes(strategy)) throw new Error("--strategy must be ordered or frequency");

const pool = DEV_WORDS.map(([word]) => word);
const pattern = (guess: string, answer: string) => scoreGuess(guess, answer).map((tile) => tile[0]).join("");
function letterScore(word: string, candidates: string[]) {
  const frequencies = new Map<string, number>();
  for (const candidate of candidates) for (const letter of new Set(candidate)) frequencies.set(letter, (frequencies.get(letter) ?? 0) + 1);
  return [...new Set(word)].reduce((sum, letter) => sum + (frequencies.get(letter) ?? 0), 0);
}
function solve(answer: string) {
  let candidates = [...pool];
  const guesses: string[] = [];
  for (let turn = 1; turn <= 6; turn += 1) {
    const guess = strategy === "ordered" ? candidates[0] : [...candidates].sort((a, b) => letterScore(b, candidates) - letterScore(a, candidates) || a.localeCompare(b))[0];
    guesses.push(guess);
    if (guess === answer) return turn;
    const observed = pattern(guess, answer);
    candidates = candidates.filter((candidate) => pattern(guess, candidate) === observed && !guesses.includes(candidate));
    if (!candidates.length) return 7;
  }
  return 7;
}

const solveByWord = new Map(pool.map((answer) => [answer, solve(answer)]));
const distribution = Array.from({ length: 7 }, () => 0);
for (let index = 0; index < rounds; index += 1) {
  const answer = pool[index % pool.length];
  const result = solveByWord.get(answer) ?? 7;
  distribution[result - 1] += 1;
}
const modeReports = Object.fromEntries(Object.entries(PAYTABLES).map(([mode, paytable]) => {
  const values = [...paytable.multipliers, 0];
  const total = values.reduce((acc, value, index) => acc + value * distribution[index], 0);
  const mean = total / rounds;
  const meanSquares = values.reduce((acc, value, index) => acc + value * value * distribution[index], 0) / rounds;
  const variance = meanSquares - mean ** 2;
  const maximum = values.reduce((highest, value) => Math.max(highest, value), 0);
  return [mode, { rtp: mean / 10000, houseEdge: 1 - mean / 10000, averageMultiplier: mean / 10000, standardDeviation: Math.sqrt(variance) / 10000, maxReturnOn100kMinor: calculateReturnMinor(10_000_000, maximum) }];
}));
const report = { generatedAt: new Date().toISOString(), poolVersion: "SPINWORD_EN_US_DEV_001", poolStatus: "DEVELOPMENT", poolSize: pool.length, solverVersion: `spinword-${strategy}-v1`, rounds, solveDistribution: Object.fromEntries(distribution.map((count, index) => [index === 6 ? "failure" : `guess${index + 1}`, count / rounds])), modes: modeReports, warning: "Development pool results are not approved RTP claims. Publish no RTP until the reviewed 2,048-word pool and strongest solver are tested." };
const directory = path.join(process.cwd(), "reports");
fs.mkdirSync(directory, { recursive: true });
const stem = `rtp-${strategy}-${rounds}`;
fs.writeFileSync(path.join(directory, `${stem}.json`), JSON.stringify(report, null, 2));
const csv = ["mode,rounds,rtp,house_edge,average_multiplier,standard_deviation", ...Object.entries(modeReports).map(([mode, value]) => { const data = value as Record<string, number>; return [mode, rounds, data.rtp, data.houseEdge, data.averageMultiplier, data.standardDeviation].join(","); })].join("\n");
fs.writeFileSync(path.join(directory, `${stem}.csv`), csv);
console.log(JSON.stringify(report, null, 2));
