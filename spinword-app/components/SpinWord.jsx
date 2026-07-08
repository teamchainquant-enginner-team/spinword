"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Coins, Trophy, Flame, Sparkles, Wallet, Share2, Crown, Dice5, Copy, Check,
  Clock, Users, Star, ChevronRight, ExternalLink, X, HelpCircle, Zap, Info,
} from "lucide-react";
import { usePhantom } from "../lib/phantom";
import { DAILY_POT, rankSolvers, computeShares, splitPreview } from "../lib/payout";

const LOGO = "/logo.png";
const DEX_URL = process.env.NEXT_PUBLIC_DEX_URL || "https://jup.ag/";
const TREASURY = process.env.NEXT_PUBLIC_TREASURY_ADDRESS || "8wTxnCjm45keH5VA4t7Hq8it47TXxgpLvXNddFvJQ31r";
const treasuryLink = "https://solscan.io/account/" + TREASURY;

/* ============================================================
   SPINWORD — desktop casino floor.
   Operator-funded daily pot. Play free, rank on speed, earn a share of the
   pot in $SPIN. No stake, no player deposits — rewards are a distribution.
   ============================================================ */

const C = {
  bg0: "#080511", bg1: "#0d0819",
  green: "#00ffa3", greenDeep: "#0b7d5a",
  gold: "#ffcf3f", goldDeep: "#b8860b",
  purple: "#a855f7", blue: "#38bdf8",
  slate: "#241d36", slateEdge: "#3a2f56",
  text: "#f4f0ff", dim: "#a99fce",
};
const glass = {
  background: "rgba(255,255,255,0.045)",
  border: "1px solid rgba(255,255,255,0.10)",
  backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
};
const btnReset = { border: "none", background: "none", color: "inherit", font: "inherit", padding: 0, margin: 0 };

const TARGETS = ["MOONS","DEGEN","STAKE","BLOCK","VAULT","CHAIN","TOKEN","MINTS","YIELD","PUMPS",
  "APING","WHALE","BAGSY","SHILL","ALPHA","LOOTS","CHIPS","SPINS","LUCKY","HOUSE",
  "ROYAL","CROWN","GOLDS","JOKER","DEALT","RAISE","BLUFF","REELS","BONUS","PRIZE"];
const ALLOWED = new Set([...TARGETS, "CRANE","SLATE","AUDIO","ROUND","STONE","HEART","LIGHT",
  "PLANT","MONEY","POWER","TRUST","BRAVE","SHINE","GRAND","WORLD","DREAM","FLAME","SPARK","GHOST"]);
const DAY_INDEX = Math.floor(Date.now() / 86400000);
const targetFor = (o = 0) => TARGETS[(DAY_INDEX + o) % TARGETS.length];
const todayKey = () => new Date().toISOString().slice(0, 10);

function score(guess, target) {
  const res = Array(5).fill("absent");
  const t = target.split(""); const counts = {};
  for (const ch of t) counts[ch] = (counts[ch] || 0) + 1;
  for (let i = 0; i < 5; i++) if (guess[i] === t[i]) { res[i] = "correct"; counts[guess[i]]--; }
  for (let i = 0; i < 5; i++) if (res[i] !== "correct" && counts[guess[i]] > 0) { res[i] = "present"; counts[guess[i]]--; }
  return res;
}
const shortAddr = (a) => a ? a.slice(0, 4) + "…" + a.slice(-4) : "";

// mock leaderboard of today's solvers (seed so the floor feels alive)
const SEED = [
  { wallet: "0x9f3aa9c21b", row: 2, timeSec: 41 },
  { wallet: "0x1c40a94e2d", row: 2, timeSec: 58 },
  { wallet: "0x77b2a9f3c1", row: 3, timeSec: 33 },
  { wallet: "0x5a1ea9d0f2", row: 3, timeSec: 77 },
  { wallet: "0xbe9aa9c447", row: 3, timeSec: 90 },
  { wallet: "0x0f3aa91b8e", row: 4, timeSec: 52 },
  { wallet: "0xaa02a9ffe1", row: 4, timeSec: 88 },
  { wallet: "0x33c1a9b7d0", row: 4, timeSec: 120 },
  { wallet: "0x7e9aa9012c", row: 5, timeSec: 61 },
  { wallet: "0xd41aa9e88f", row: 5, timeSec: 143 },
  { wallet: "0x2b8aa9c39a", row: 6, timeSec: 99 },
];

// ============================================================
export default function App() {
  const phantom = usePhantom();
  const wallet = phantom.address;
  const [coins, setCoins] = useState(0);          // player's earned $SPIN (local tally / projection)
  const [streak, setStreak] = useState(0);
  const [history, setHistory] = useState([]);
  const [solvedToday, setSolvedToday] = useState(null); // {row,timeSec}
  const [profileOpen, setProfileOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const [result, setResult] = useState(null);      // {won,row,timeSec,rank,share} | {won:false}

  // persist local progress (swap for Supabase in prod)
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem("spinword") || "null");
      if (s) { setCoins(s.coins || 0); setStreak(s.streak || 0); setHistory(s.history || []);
        if (s.solvedDate === todayKey()) setSolvedToday(s.solvedToday || null); }
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem("spinword", JSON.stringify({ coins, streak, history, solvedToday, solvedDate: todayKey() })); } catch {}
  }, [coins, streak, history, solvedToday]);

  const referral = "spinword.xyz/r/" + (wallet ? shortAddr(wallet).replace("…", "") : "DEGEN42");

  // build today's leaderboard, optionally including the player
  const buildBoard = (playerEntry) => {
    const solvers = [...SEED];
    if (playerEntry) solvers.push({ wallet: wallet || "0xDEGEN42you", you: true, ...playerEntry });
    return computeShares(rankSolvers(solvers));
  };
  const board = buildBoard(solvedToday);

  const onSolve = (row, timeSec) => {
    const entry = { row, timeSec };
    setSolvedToday(entry);
    const ranked = buildBoard(entry);
    const me = ranked.find((r) => r.you);
    setResult({ won: true, row, timeSec, rank: me.rank, share: me.share });
    setCoins((c) => c + me.share);
    setStreak((s) => s + 1);
    setHistory((h) => [{ word: targetFor(0), row, won: true, share: me.share }, ...h].slice(0, 30));
  };
  const onFail = () => {
    setResult({ won: false });
    setStreak(0);
    setHistory((h) => [{ word: targetFor(0), won: false }, ...h].slice(0, 30));
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg0, color: C.text,
      fontFamily: "'Trebuchet MS','Segoe UI',system-ui,sans-serif", position: "relative", overflowX: "hidden" }}>
      <Style />
      <Backdrop />
      <div style={{ position: "relative", zIndex: 2 }}>
        <TopNav phantom={phantom} coins={coins} onProfile={() => setProfileOpen(true)} onHow={() => setHowOpen(true)} />

        {/* hero strip */}
        <Hero />

        {/* casino floor */}
        <div className="sw-wrap">
          <div className="sw-floor">
            <aside className="sw-rail">
              <PotCard board={board} />
              <PotSplitCard />
              <FairnessCard />
            </aside>

            <main className="sw-center">
              <GameCard target={targetFor(0)} solvedToday={solvedToday}
                onSolve={onSolve} onFail={onFail} phantom={phantom} />
            </main>

            <aside className="sw-rail">
              <LeaderRail board={board} />
              <StreakCard streak={streak} coins={coins} wallet={wallet} />
            </aside>
          </div>
        </div>

        <Footer />
      </div>

      {result && <ResultModal result={result} target={targetFor(0)} phantom={phantom} onClose={() => setResult(null)} />}
      {profileOpen && <ProfileModal phantom={phantom} coins={coins} streak={streak} history={history}
        referral={referral} onClose={() => setProfileOpen(false)} />}
      {howOpen && <HowModal onClose={() => setHowOpen(false)} />}
    </div>
  );
}

// ============================================================
function Backdrop() {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none" }}>
      <div style={{ position: "absolute", inset: 0, background:
        `radial-gradient(1100px 700px at 12% -8%, rgba(168,85,247,0.26), transparent 60%),
         radial-gradient(1000px 700px at 90% -4%, rgba(56,189,248,0.18), transparent 55%),
         radial-gradient(1200px 900px at 50% 118%, rgba(0,255,163,0.14), transparent 55%),
         linear-gradient(${C.bg1}, ${C.bg0})` }} />
      <div style={{ position: "absolute", inset: 0, opacity: 0.05, backgroundImage:
        "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
        backgroundSize: "48px 48px", maskImage: "radial-gradient(circle at 50% 30%, #000, transparent 80%)" }} />
      {[...Array(12)].map((_, i) => (
        <span key={i} style={{ position: "absolute", left: `${(i * 8.3 + 3) % 100}%`, top: "-8%",
          fontSize: 12 + (i % 3) * 6, opacity: 0.22, animation: `fall ${10 + (i % 5) * 2}s linear ${i}s infinite` }}>🪙</span>
      ))}
    </div>
  );
}

function TopNav({ phantom, coins, onProfile, onHow }) {
  const wallet = phantom.address;
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 40, ...glass, borderLeft: "none", borderRight: "none", borderTop: "none" }}>
      <div className="sw-wrap" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          <img src={LOGO} alt="SpinWord" style={{ height: 46, width: "auto", display: "block", filter: `drop-shadow(0 0 12px ${C.purple}66)` }} />
          <nav className="sw-nav" style={{ display: "flex", gap: 20, fontWeight: 700, fontSize: 14 }}>
            <a style={navLink} href="#play">Play</a>
            <a style={navLink} href="#leaderboard">Leaderboard</a>
            <button style={{ ...btnReset, ...navLink, cursor: "pointer" }} onClick={onHow}>How it works</button>
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a href={DEX_URL} target="_blank" rel="noreferrer" style={{ ...btnReset, textDecoration: "none",
            display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 15px", borderRadius: 11, fontWeight: 900, fontSize: 13.5,
            color: "#150e26", background: `linear-gradient(90deg,${C.gold},${C.green})`, boxShadow: `0 0 18px ${C.green}44` }}>
            Buy $SPIN <ExternalLink size={14} />
          </a>
          {wallet && <Pill icon={<Coins size={13} color={C.gold} />} text={`${coins.toLocaleString()} $SPIN`} />}
          <button onClick={onProfile} style={{ ...btnReset, ...glass, borderRadius: 11, padding: "9px 14px", fontWeight: 800,
            fontSize: 13.5, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7,
            border: wallet ? `1px solid ${C.green}55` : glass.border }}>
            <Wallet size={15} color={wallet ? C.green : C.dim} />
            {phantom.connecting ? "…" : wallet ? shortAddr(wallet) : "Connect"}
          </button>
        </div>
      </div>
    </header>
  );
}
const navLink = { color: "#cfc7ee", textDecoration: "none", opacity: 0.85 };

function Pill({ icon, text }) {
  return (
    <div style={{ ...glass, borderRadius: 999, padding: "7px 12px", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 800 }}>
      {icon}<span>{text}</span>
    </div>
  );
}

function Hero() {
  return (
    <section id="play" className="sw-wrap" style={{ padding: "34px 22px 8px", textAlign: "center" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 7, ...glass, borderRadius: 999,
        padding: "6px 14px", fontSize: 12, fontWeight: 800, letterSpacing: 0.6, color: C.green, marginBottom: 16 }}>
        <span style={{ width: 7, height: 7, borderRadius: 99, background: C.green, boxShadow: `0 0 10px ${C.green}` }} />
        LIVE ON SOLANA · POWERED BY $SPIN
      </div>
      <h1 style={{ fontSize: 46, lineHeight: 1.04, fontWeight: 900, margin: "0 0 12px", letterSpacing: -0.5 }}>
        Guess the word. Spin the reels.{" "}
        <span style={{ background: `linear-gradient(90deg,${C.gold},${C.green},${C.purple})`,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Split the pot.</span>
      </h1>
      <p style={{ color: C.dim, fontSize: 16, maxWidth: 620, margin: "0 auto" }}>
        One daily 5-letter mystery word. Solve it fast, climb the board, and earn your share of a treasury-funded
        <b style={{ color: C.gold }}> $SPIN</b> pot. Free to play — no buy-in, no stake.
      </p>
    </section>
  );
}

// ---------------- LEFT RAIL ----------------
function PotCard({ board }) {
  const solvers = board.length;
  return (
    <div style={{ ...glass, borderRadius: 18, padding: 18, border: `1px solid ${C.gold}44`, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(120deg, ${C.gold}14, transparent 60%)` }} />
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
          <Crown size={16} color={C.gold} />
          <span style={{ fontSize: 11, letterSpacing: 2, color: C.dim, fontWeight: 900 }}>TODAY'S POT</span>
        </div>
        <div style={{ fontSize: 34, fontWeight: 900, color: C.gold, textShadow: `0 0 22px ${C.gold}66`, lineHeight: 1.05 }}>
          {DAILY_POT.toLocaleString()}
        </div>
        <div style={{ fontSize: 13, color: C.dim, fontWeight: 700, marginBottom: 6 }}>$SPIN · funded by treasury</div>
        <a href={treasuryLink} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5,
          fontSize: 11, color: C.blue, fontWeight: 700, marginBottom: 12, fontFamily: "monospace" }}>
          Treasury {shortAddr(TREASURY)} <ExternalLink size={11} />
        </a>
        <PotCountdown />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 12.5, color: C.dim }}>
          <span><Users size={12} color={C.green} /> {solvers} solved today</span>
          <span style={{ color: C.green, fontWeight: 800 }}>paid to top solvers</span>
        </div>
      </div>
    </div>
  );
}
function PotCountdown() {
  const [t, setT] = useState("");
  useEffect(() => {
    const tick = () => {
      const now = new Date(); const end = new Date(now); end.setUTCHours(24, 0, 0, 0);
      const d = end - now, h = Math.floor(d / 3.6e6), m = Math.floor((d % 3.6e6) / 6e4), s = Math.floor((d % 6e4) / 1e3);
      setT(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`);
    };
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, []);
  return (
    <div style={{ ...glass, borderRadius: 12, padding: "9px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontSize: 12, color: C.dim, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}><Clock size={13} /> settles in</span>
      <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 900, color: C.text }}>{t}</span>
    </div>
  );
}
function PotSplitCard() {
  const [p1, p2, p3] = splitPreview();
  return (
    <div style={{ ...glass, borderRadius: 16, padding: 16 }}>
      <div style={{ fontSize: 11, letterSpacing: 2, color: C.dim, fontWeight: 900, marginBottom: 10 }}>HOW THE POT SPLITS</div>
      {[["🥇 1st", p1, C.gold], ["🥈 2nd", p2, "#c9d3e0"], ["🥉 3rd", p3, "#e0975a"],
        ["Everyone else who solves", 100 - p1 - p2 - p3, C.green]].map(([label, pct, col]) => (
        <div key={label} style={{ marginBottom: 9 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 700, marginBottom: 3 }}>
            <span>{label}</span><span style={{ color: col }}>{pct}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 99, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: col, borderRadius: 99 }} />
          </div>
        </div>
      ))}
      <div style={{ fontSize: 11.5, color: C.dim, marginTop: 8, lineHeight: 1.5 }}>
        Rank by fewest guesses, then fastest solve. Shares are rank-weighted — solving early pays more.
      </div>
    </div>
  );
}
function FairnessCard() {
  return (
    <div style={{ ...glass, borderRadius: 16, padding: 14, border: `1px solid ${C.blue}33` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
        <Info size={14} color={C.blue} /><span style={{ fontWeight: 800, fontSize: 13 }}>No buy-in</span>
      </div>
      <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.55 }}>
        You never stake or deposit to play. The pot is funded by the operator and distributed to top solvers as a $SPIN reward.
        Payouts settle on-chain at 00:00 UTC to connected wallets.
      </div>
    </div>
  );
}

// ---------------- CENTER: GAME ----------------
function GameCard({ target, solvedToday, onSolve, onFail, phantom }) {
  const MAX = 6;
  const [rows, setRows] = useState([]);
  const [cur, setCur] = useState("");
  const [reveal, setReveal] = useState(null);
  const [status, setStatus] = useState(solvedToday ? "done" : "play");
  const [keyState, setKeyState] = useState({});
  const [toast, setToast] = useState("");
  const startRef = useRef(null);
  const intervals = useRef([]);
  const done = status !== "play";
  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 1500); };

  const submit = useCallback(() => {
    if (done || reveal) return;
    if (cur.length !== 5) return showToast("Need 5 letters");
    if (startRef.current == null) startRef.current = Date.now();
    const states = score(cur, target);
    const tiles = cur.split("").map((l) => ({ mode: "spin", letter: "?", final: l }));
    setReveal({ states, tiles });
    intervals.current.forEach(clearInterval); intervals.current = [];
    const spin = setInterval(() => {
      setReveal((r) => r && ({ ...r, tiles: r.tiles.map((t) => t.mode === "spin"
        ? { ...t, letter: "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)] } : t) }));
    }, 55);
    intervals.current.push(spin);
    cur.split("").forEach((l, i) => {
      const to = setTimeout(() => setReveal((r) => {
        if (!r) return r; const tiles = r.tiles.slice();
        tiles[i] = { mode: "locked", letter: l, status: states[i], final: l }; return { ...r, tiles };
      }), 520 + i * 300);
      intervals.current.push(to);
    });
    const fin = setTimeout(() => {
      clearInterval(spin);
      const newRows = [...rows, { letters: cur.split(""), states }];
      setRows(newRows); setReveal(null); setCur("");
      setKeyState((ks) => { const n = { ...ks }; const rank = { absent: 0, present: 1, correct: 2 };
        cur.split("").forEach((l, i) => { if (rank[states[i]] >= (rank[n[l]] ?? -1)) n[l] = states[i]; }); return n; });
      const won = states.every((s) => s === "correct");
      if (won) {
        setStatus("done");
        const timeSec = Math.max(1, Math.round((Date.now() - startRef.current) / 1000));
        onSolve(newRows.length, timeSec);
      } else if (newRows.length >= MAX) {
        setStatus("done"); onFail();
      }
    }, 520 + 5 * 300 + 120);
    intervals.current.push(fin);
  }, [cur, done, reveal, rows, target, onSolve, onFail]);

  useEffect(() => () => intervals.current.forEach(clearInterval), []);
  useEffect(() => {
    const onKey = (e) => {
      if (done || reveal) return;
      if (e.key === "Enter") submit();
      else if (e.key === "Backspace") setCur((c) => c.slice(0, -1));
      else if (/^[a-zA-Z]$/.test(e.key)) setCur((c) => (c.length < 5 ? c + e.key.toUpperCase() : c));
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [submit, done, reveal]);

  const tap = (k) => { if (done || reveal) return; if (k === "ENTER") submit(); else if (k === "DEL") setCur((c) => c.slice(0, -1)); else setCur((c) => (c.length < 5 ? c + k : c)); };

  const grid = [];
  for (let r = 0; r < MAX; r++) {
    if (r < rows.length) grid.push({ type: "done", data: rows[r] });
    else if (r === rows.length && reveal) grid.push({ type: "reveal", data: reveal });
    else if (r === rows.length) grid.push({ type: "cur" });
    else grid.push({ type: "empty" });
  }

  return (
    <div id="leaderboard-anchor" style={{ ...glass, borderRadius: 22, padding: 22, boxShadow: "0 24px 80px rgba(0,0,0,0.35)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Dice5 size={17} color={C.purple} />
          <span style={{ fontWeight: 900, fontSize: 15 }}>Daily Mystery Word</span>
        </div>
        <span style={{ fontSize: 12, color: C.dim, fontWeight: 700 }}>Resets 00:00 UTC</span>
      </div>
      <div style={{ fontSize: 12.5, color: C.dim, marginBottom: 16 }}>Six guesses. Green = exact · Gold = wrong spot · Dark = miss.</div>

      {solvedToday && status === "done" && rows.length === 0 ? (
        <div style={{ textAlign: "center", padding: "26px 0" }}>
          <Check size={30} color={C.green} />
          <div style={{ fontWeight: 900, fontSize: 18, marginTop: 8 }}>You already solved today's word</div>
          <div style={{ color: C.dim, fontSize: 13.5, marginTop: 4 }}>
            Solved on row {solvedToday.row} in {solvedToday.timeSec}s. Pot settles at 00:00 UTC — come back for a fresh word.
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gap: 8, justifyContent: "center", margin: "4px 0 18px" }}>
            {grid.map((row, ri) => (
              <div key={ri} style={{ display: "flex", gap: 8 }}>
                {[0,1,2,3,4].map((ci) => {
                  if (row.type === "done") return <Tile key={ci} letter={row.data.letters[ci]} status={row.data.states[ci]} revealDelay={ci * 0.06} />;
                  if (row.type === "reveal") { const t = row.data.tiles[ci]; return <Tile key={ci} letter={t.letter} status={t.mode === "locked" ? t.status : "spin"} spinning={t.mode === "spin"} />; }
                  if (row.type === "cur") return <Tile key={ci} letter={cur[ci] || ""} status={cur[ci] ? "typed" : "empty"} />;
                  return <Tile key={ci} letter="" status="empty" />;
                })}
              </div>
            ))}
          </div>
          {toast && <div style={{ textAlign: "center", ...glass, borderRadius: 10, padding: "7px 12px", fontSize: 13, fontWeight: 700, margin: "0 auto 12px", maxWidth: 260 }}>{toast}</div>}
          {!done && <Keyboard onKey={tap} keyState={keyState} disabled={!!reveal} />}
        </>
      )}
    </div>
  );
}

function Tile({ letter, status, spinning, revealDelay = 0 }) {
  const s = tileStyle(status);
  const animate = ["correct","present","absent"].includes(status) && !spinning;
  return (
    <div style={{ ...s, width: 58, height: 58, fontSize: 26, position: "relative", overflow: "hidden",
      animation: animate ? `flip 0.5s ${revealDelay}s both` : undefined }}>
      <span style={{ animation: spinning ? "reelBlur 0.09s linear infinite" : (status === "typed" ? "pop 0.12s" : undefined), filter: spinning ? "blur(0.6px)" : "none" }}>{letter}</span>
      {spinning && <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(255,255,255,0.14), transparent 30%, transparent 70%, rgba(0,0,0,0.35))" }} />}
    </div>
  );
}
function tileStyle(status) {
  const base = { borderRadius: 12, display: "grid", placeItems: "center", fontWeight: 900, color: "#fff",
    border: "1.5px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.03)", userSelect: "none" };
  if (status === "correct") return { ...base, background: `linear-gradient(180deg,${C.green},${C.greenDeep})`, border: `1.5px solid ${C.green}`, boxShadow: `0 0 20px ${C.green}66`, color: "#06231a" };
  if (status === "present") return { ...base, background: `linear-gradient(180deg,${C.gold},${C.goldDeep})`, border: `1.5px solid ${C.gold}`, boxShadow: `0 0 20px ${C.gold}55`, color: "#241800" };
  if (status === "absent") return { ...base, background: C.slate, border: `1.5px solid ${C.slateEdge}`, color: "#8b81a8" };
  if (status === "typed") return { ...base, border: `1.5px solid ${C.purple}`, boxShadow: `0 0 14px ${C.purple}44` };
  if (status === "spin") return { ...base, background: "linear-gradient(180deg,#2a2140,#181026)", border: `1.5px solid ${C.purple}88` };
  return base;
}

function Keyboard({ onKey, keyState, disabled }) {
  const rows = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
  const kcol = (s) => s === "correct" ? C.green : s === "present" ? C.gold : s === "absent" ? C.slate : "rgba(255,255,255,0.07)";
  return (
    <div style={{ display: "grid", gap: 7, opacity: disabled ? 0.55 : 1, maxWidth: 500, margin: "0 auto" }}>
      <button onClick={() => onKey("ENTER")} style={{ ...btnReset, borderRadius: 12, padding: 13, fontWeight: 900, letterSpacing: 2,
        fontSize: 15, color: "#150e26", cursor: "pointer", background: `linear-gradient(90deg,${C.gold},${C.green})`, boxShadow: `0 0 18px ${C.green}44` }}>
        SPIN REVEAL
      </button>
      {rows.map((r, ri) => (
        <div key={ri} style={{ display: "flex", gap: 5, justifyContent: "center" }}>
          {ri === 2 && <Key onClick={() => onKey("DEL")} wide>⌫</Key>}
          {r.split("").map((k) => <Key key={k} onClick={() => onKey(k)} bg={kcol(keyState[k])}>{k}</Key>)}
        </div>
      ))}
    </div>
  );
}
function Key({ children, onClick, wide, bg }) {
  return <button onClick={onClick} style={{ ...btnReset, flex: wide ? 1.6 : 1, minWidth: 0, height: 50, borderRadius: 9,
    fontWeight: 800, fontSize: 16, color: "#fff", background: bg || "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}>{children}</button>;
}

// ---------------- RIGHT RAIL ----------------
function LeaderRail({ board }) {
  const top = board.slice(0, 10);
  return (
    <div id="leaderboard" style={{ ...glass, borderRadius: 18, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
        <Trophy size={16} color={C.gold} />
        <span style={{ fontWeight: 900, fontSize: 14 }}>Today's Leaderboard</span>
      </div>
      {top.map((r) => {
        const medal = ["#ffcf3f","#c9d3e0","#e0975a"][r.rank - 1];
        return (
          <div key={r.rank} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 8px", borderRadius: 11,
            background: r.you ? `${C.purple}22` : "transparent", border: r.you ? `1px solid ${C.purple}66` : "1px solid transparent", marginBottom: 2 }}>
            <div style={{ width: 20, textAlign: "center", fontWeight: 900, fontSize: 14, color: r.rank <= 3 ? medal : C.dim,
              textShadow: r.rank <= 3 ? `0 0 8px ${medal}` : "none" }}>{r.rank}</div>
            <div style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0,
              background: `conic-gradient(from ${r.rank * 40}deg, ${C.purple}, ${C.blue}, ${C.green}, ${C.gold})`, opacity: 0.85 }} />
            <div style={{ flex: 1, fontFamily: "monospace", fontSize: 12.5, fontWeight: 700 }}>
              {r.you ? <span style={{ color: C.purple }}>{shortAddr(r.wallet)} · you</span> : shortAddr(r.wallet)}
              <div style={{ fontSize: 10, color: C.dim }}>row {r.row} · {r.timeSec}s</div>
            </div>
            <div style={{ fontWeight: 900, fontSize: 12.5, color: C.gold, textAlign: "right" }}>{r.share.toLocaleString()}</div>
          </div>
        );
      })}
      <div style={{ fontSize: 11, color: C.dim, textAlign: "center", marginTop: 8 }}>Shares in $SPIN · settle 00:00 UTC</div>
    </div>
  );
}
function StreakCard({ streak, coins, wallet }) {
  return (
    <div style={{ ...glass, borderRadius: 16, padding: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Stat icon={<Flame size={16} color={C.green} />} val={streak} label="Day streak" />
        <Stat icon={<Coins size={16} color={C.gold} />} val={coins.toLocaleString()} label="$SPIN earned" />
      </div>
      {!wallet && <div style={{ fontSize: 11.5, color: C.dim, marginTop: 10, textAlign: "center" }}>
        Connect Phantom so your pot share settles to your wallet.
      </div>}
    </div>
  );
}
function Stat({ icon, val, label }) {
  return (
    <div style={{ textAlign: "center", ...glass, borderRadius: 12, padding: "12px 6px" }}>
      <div style={{ marginBottom: 3 }}>{icon}</div>
      <div style={{ fontWeight: 900, fontSize: 18 }}>{val}</div>
      <div style={{ fontSize: 10.5, color: C.dim, fontWeight: 700 }}>{label}</div>
    </div>
  );
}

// ---------------- MODALS ----------------
function Modal({ children, onClose, wide }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(5,3,12,0.8)", backdropFilter: "blur(6px)",
      display: "grid", placeItems: "center", padding: 20, animation: "fade .2s" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: wide ? 560 : 420, ...glass, borderRadius: 22, padding: 22,
        border: "1px solid rgba(255,255,255,0.16)", boxShadow: "0 20px 80px rgba(0,0,0,0.6)", position: "relative", animation: "popIn .3s", maxHeight: "88vh", overflowY: "auto" }}>
        <button onClick={onClose} style={{ ...btnReset, position: "absolute", top: 14, right: 14, cursor: "pointer", color: C.dim }}><X size={20} /></button>
        {children}
      </div>
    </div>
  );
}

function ResultModal({ result, target, phantom, onClose }) {
  if (result.won) {
    return (
      <Modal onClose={onClose}>
        <CoinBurst />
        <div style={{ textAlign: "center", position: "relative" }}>
          <div style={{ fontSize: 12, letterSpacing: 3, color: C.gold, fontWeight: 900 }}>★ SOLVED · RANK #{result.rank} ★</div>
          <div style={{ fontSize: 32, fontWeight: 900, margin: "6px 0", background: `linear-gradient(90deg,${C.gold},${C.green})`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>POT SHARE</div>
          <div style={{ display: "flex", gap: 7, justifyContent: "center", margin: "10px 0" }}>
            {target.split("").map((c, i) => <div key={i} style={{ ...tileStyle("correct"), width: 46, height: 46, fontSize: 22, animation: `pop .4s ${i * 0.08}s both` }}>{c}</div>)}
          </div>
          <div style={{ ...glass, borderRadius: 12, padding: 14, margin: "10px 0" }}>
            <div style={{ fontSize: 12, color: C.dim, fontWeight: 700 }}>Projected reward · row {result.row} · {result.timeSec}s</div>
            <div style={{ fontSize: 30, fontWeight: 900, color: C.gold }}>+{result.share.toLocaleString()} $SPIN</div>
            <div style={{ fontSize: 12, color: C.green, marginTop: 3 }}>
              {phantom.address ? "Settles to your wallet at 00:00 UTC" : "Connect Phantom so this settles to your wallet"}
            </div>
          </div>
          <ShareRow target={target} row={result.row} rank={result.rank} won />
          {!phantom.address && (
            <button onClick={phantom.connect} style={{ ...btnReset, marginTop: 10, width: "100%", borderRadius: 12, padding: 12,
              fontWeight: 900, cursor: "pointer", color: "#150e26", background: `linear-gradient(90deg,#ab9ff2,${C.purple})` }}>
              <Wallet size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} /> Connect Phantom
            </button>
          )}
        </div>
      </Modal>
    );
  }
  return (
    <Modal onClose={onClose}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 12, letterSpacing: 3, color: C.dim, fontWeight: 900 }}>HOUSE WINS THIS ROUND</div>
        <div style={{ fontSize: 28, fontWeight: 900, margin: "8px 0" }}>Try tomorrow</div>
        <div style={{ fontSize: 13, color: C.dim }}>The word was</div>
        <div style={{ display: "flex", gap: 7, justifyContent: "center", margin: "10px 0" }}>
          {target.split("").map((c, i) => <div key={i} style={{ ...tileStyle("present"), width: 46, height: 46, fontSize: 22 }}>{c}</div>)}
        </div>
        <div style={{ ...glass, borderRadius: 12, padding: 12, fontSize: 13, color: C.dim }}>
          A fresh word and a fresh pot drop at 00:00 UTC. Build a streak to climb the all-time board.
        </div>
        <ShareRow target={target} won={false} />
      </div>
    </Modal>
  );
}

function ShareRow({ target, row, rank, won }) {
  const [copied, setCopied] = useState(false);
  const grid = won
    ? Array(row - 1).fill("🟨🟨🟩🟩🟨").concat("🟩🟩🟩🟩🟩")
    : ["⬛🟨⬛🟩⬛", "🟨🟩⬛⬛🟨", "⬛🟩🟩🟨⬛"];
  const text = won
    ? `SPINWORD 🎰 solved ${row}/6 · rank #${rank}\n${grid.join("\n")}\nSplit the pot 👉 spinword.xyz/r/DEGEN42`
    : `SPINWORD 🎰 X/6 today\n${grid.join("\n")}\nSplit the pot 👉 spinword.xyz/r/DEGEN42`;
  const copy = async () => { try { await navigator.clipboard.writeText(text); } catch {} setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div>
      <div style={{ ...glass, borderRadius: 10, padding: 10, fontSize: 12.5, lineHeight: 1.5, textAlign: "left", whiteSpace: "pre-wrap", fontFamily: "monospace" }}>{text}</div>
      <button onClick={copy} style={{ ...btnReset, marginTop: 8, width: "100%", ...glass, borderRadius: 11, padding: 11, fontWeight: 900,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 7, cursor: "pointer", border: `1px solid ${C.green}55`, color: C.green }}>
        {copied ? <><Check size={16} /> Copied — paste to X</> : <><Share2 size={16} /> Share result on X</>}
      </button>
    </div>
  );
}

function ProfileModal({ phantom, coins, streak, history, referral, onClose }) {
  const wallet = phantom.address;
  const [copied, setCopied] = useState(false);
  const copyRef = async () => { try { await navigator.clipboard.writeText("https://" + referral); } catch {} setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <Modal onClose={onClose} wide>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 60, height: 60, borderRadius: 16, margin: "0 auto 10px",
          background: `conic-gradient(from 120deg,${C.gold},${C.green},${C.purple},${C.blue},${C.gold})`, display: "grid", placeItems: "center",
          fontWeight: 900, fontSize: 24, color: "#150e26" }}>{wallet ? "◎" : "👤"}</div>
        <div style={{ fontWeight: 900, fontSize: 17, fontFamily: "monospace" }}>{wallet ? shortAddr(wallet) : "Guest Degen"}</div>
        <div style={{ fontSize: 12.5, color: C.dim }}>{phantom.error ? phantom.error : wallet ? "Phantom connected · Solana" : "Connect to receive pot shares"}</div>
        {wallet && (
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 10 }}>
            <Pill icon={<Coins size={13} color={C.gold} />} text={`${phantom.spinBalance ?? "—"} $SPIN`} />
            <Pill icon={<Sparkles size={13} color={C.green} />} text={`${phantom.solBalance ?? "—"} SOL`} />
          </div>
        )}
        <button onClick={wallet ? phantom.disconnect : phantom.connect} style={{ ...btnReset, marginTop: 12, borderRadius: 12, padding: "10px 20px",
          fontWeight: 900, cursor: "pointer", color: wallet ? C.dim : "#150e26",
          background: wallet ? "rgba(255,255,255,0.06)" : `linear-gradient(90deg,#ab9ff2,${C.purple})` }}>
          {phantom.connecting ? "Connecting…" : wallet ? "Disconnect" : "Connect Phantom"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
        <Stat icon={<Flame size={16} color={C.green} />} val={streak} label="Day streak" />
        <Stat icon={<Coins size={16} color={C.gold} />} val={coins.toLocaleString()} label="$SPIN earned" />
      </div>

      <div style={{ fontSize: 11, letterSpacing: 2, color: C.dim, fontWeight: 900, margin: "16px 0 8px" }}>REFERRAL — EARN BONUS $SPIN PER INVITE</div>
      <div style={{ ...glass, borderRadius: 12, padding: 11, display: "flex", alignItems: "center", gap: 10, border: `1px solid ${C.green}44` }}>
        <div style={{ flex: 1, fontFamily: "monospace", fontSize: 12.5, color: C.green, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{referral}</div>
        <button onClick={copyRef} style={{ ...btnReset, borderRadius: 9, padding: "8px 12px", fontWeight: 800, fontSize: 12.5, cursor: "pointer",
          color: "#150e26", background: `linear-gradient(90deg,${C.green},${C.blue})`, display: "flex", gap: 5, alignItems: "center" }}>
          {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
        </button>
      </div>

      <div style={{ fontSize: 11, letterSpacing: 2, color: C.dim, fontWeight: 900, margin: "16px 0 8px" }}>RECENT GAMES</div>
      {history.length === 0 ? (
        <div style={{ ...glass, borderRadius: 12, padding: 14, textAlign: "center", color: C.dim, fontSize: 13 }}>No games yet — solve today's word.</div>
      ) : (
        <div style={{ display: "grid", gap: 6 }}>
          {history.slice(0, 6).map((h, i) => (
            <div key={i} style={{ ...glass, borderRadius: 10, padding: "9px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 900, letterSpacing: 3, fontFamily: "monospace" }}>{h.word}</span>
              <span style={{ fontWeight: 800, fontSize: 12.5, color: h.won ? C.green : C.dim }}>
                {h.won ? `+${(h.share || 0).toLocaleString()} $SPIN · ${h.row}/6` : "MISSED"}</span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function HowModal({ onClose }) {
  const steps = [
    { i: <Dice5 size={18} color={C.blue} />, t: "Solve the daily word", d: "One 5-letter mystery word, six guesses, same for everyone that day." },
    { i: <Zap size={18} color={C.gold} />, t: "Speed = rank", d: "Fewer guesses and a faster solve rank you higher on today's board." },
    { i: <Crown size={18} color={C.purple} />, t: "Split the pot", d: "The treasury-funded $SPIN pot is shared rank-weighted among everyone who solves." },
    { i: <Wallet size={18} color={C.green} />, t: "Settles to your wallet", d: "Connect Phantom; shares settle on-chain at 00:00 UTC. No buy-in, ever." },
  ];
  return (
    <Modal onClose={onClose} wide>
      <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 4 }}>How SpinWord works</div>
      <div style={{ color: C.dim, fontSize: 13.5, marginBottom: 14 }}>Free to play. Hold $SPIN because it's the reward token — earn more by playing well.</div>
      <div style={{ display: "grid", gap: 10 }}>
        {steps.map((s, k) => (
          <div key={k} style={{ ...glass, borderRadius: 14, padding: 13, display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, ...glass, display: "grid", placeItems: "center", flexShrink: 0 }}>{s.i}</div>
            <div><div style={{ fontWeight: 800, fontSize: 14.5 }}>{s.t}</div><div style={{ color: C.dim, fontSize: 13 }}>{s.d}</div></div>
          </div>
        ))}
      </div>
      <div style={{ ...glass, borderRadius: 12, padding: 12, marginTop: 12, fontSize: 12, color: C.dim, border: `1px solid ${C.blue}33` }}>
        The pot is funded by the operator and distributed as a reward. Players never stake or deposit to play.
      </div>
    </Modal>
  );
}

function Footer() {
  return (
    <footer className="sw-wrap" style={{ padding: "26px 22px 40px", marginTop: 24, borderTop: "1px solid rgba(255,255,255,0.07)", color: C.dim, fontSize: 12.5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src={LOGO} alt="SpinWord" style={{ height: 30 }} />
          <span>© {new Date().getFullYear()} SpinWord · $SPIN on Solana</span>
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          <a href={DEX_URL} target="_blank" rel="noreferrer" style={{ color: C.dim }}>Buy $SPIN</a>
          <a href="#play" style={{ color: C.dim }}>Play</a>
          <a href="#leaderboard" style={{ color: C.dim }}>Leaderboard</a>
        </div>
      </div>
      <div style={{ marginTop: 10, fontSize: 11.5, opacity: 0.8, maxWidth: 720 }}>
        Rewards are distributed from an operator-funded pot; players do not stake or deposit to play. Availability may be
        restricted by region. Nothing here is financial advice.
      </div>
    </footer>
  );
}

function CoinBurst() {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", borderRadius: 22 }}>
      {[...Array(16)].map((_, i) => (
        <span key={i} style={{ position: "absolute", left: `${5 + (i * 6.1) % 92}%`, top: "42%", fontSize: 15 + (i % 3) * 6,
          animation: `burst ${0.9 + (i % 4) * 0.25}s ${(i % 5) * 0.05}s ease-out forwards` }}>🪙</span>
      ))}
    </div>
  );
}

function Style() {
  return (
    <style>{`
      * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
      html, body { margin: 0; }
      a { text-decoration: none; }
      .sw-wrap { max-width: 1180px; margin: 0 auto; width: 100%; }
      .sw-floor { display: grid; grid-template-columns: 290px 1fr 320px; gap: 18px; align-items: start; padding: 12px 22px 0; }
      .sw-rail { display: grid; gap: 14px; position: sticky; top: 78px; }
      @media (max-width: 1080px) {
        .sw-floor { grid-template-columns: 1fr; }
        .sw-rail { position: static; grid-template-columns: 1fr 1fr; }
        .sw-center { order: -1; }
      }
      @media (max-width: 640px) {
        .sw-rail { grid-template-columns: 1fr; }
        .sw-nav { display: none; }
      }
      ::-webkit-scrollbar { width: 7px; height: 7px; }
      ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 9px; }
      @keyframes fall { 0%{transform:translateY(-10vh) rotate(0)} 100%{transform:translateY(112vh) rotate(360deg)} }
      @keyframes reelBlur { 0%{transform:translateY(-2px)} 100%{transform:translateY(2px)} }
      @keyframes flip { 0%{transform:rotateX(0)} 50%{transform:rotateX(90deg)} 100%{transform:rotateX(0)} }
      @keyframes pop { 0%{transform:scale(0.5);opacity:0} 60%{transform:scale(1.12)} 100%{transform:scale(1);opacity:1} }
      @keyframes popIn { 0%{transform:scale(0.9) translateY(12px);opacity:0} 100%{transform:scale(1) translateY(0);opacity:1} }
      @keyframes fade { from{opacity:0} to{opacity:1} }
      @keyframes burst { 0%{transform:translateY(0) scale(0.4);opacity:0} 20%{opacity:1} 100%{transform:translateY(-160px) scale(1.1);opacity:0} }
      @media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; } }
    `}</style>
  );
}
