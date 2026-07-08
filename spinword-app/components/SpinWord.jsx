"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Coins, Trophy, Flame, Gift, Sparkles, Wallet, Share2, Shield, Zap,
  Crown, Dice5, TrendingUp, Copy, Check, X, Ticket, Gem, Play, Clock,
  Users, ChevronRight, Star, Lightbulb, Plus, Home,
} from "lucide-react";
import { usePhantom } from "../lib/phantom";

/* ============================================================
   SPINWORD — "Guess the word. Spin the reels. Hit the jackpot."
   Wordle x slot machine x crypto loot. Free in-game coins only.
   ============================================================ */

// ---------- theme tokens ----------
const LOGO = "/logo.png";

const C = {
  bg0: "#080511",
  bg1: "#0d0819",
  green: "#00ffa3",
  greenDeep: "#0b7d5a",
  gold: "#ffcf3f",
  goldDeep: "#b8860b",
  purple: "#a855f7",
  blue: "#38bdf8",
  slate: "#241d36",
  slateEdge: "#3a2f56",
  text: "#f4f0ff",
  dim: "#a99fce",
};
const glass = {
  background: "rgba(255,255,255,0.045)",
  border: "1px solid rgba(255,255,255,0.10)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
};

// ---------- word data ----------
const TARGETS = ["MOONS","DEGEN","STAKE","BLOCK","VAULT","CHAIN","TOKEN","MINTS","YIELD","PUMPS",
  "APING","WHALE","BAGSY","SHILL","ALPHA","LOOTS","CHIPS","SPINS","LUCKY","HOUSE",
  "ROYAL","CROWN","GOLDS","JOKER","DEALT","RAISE","BLUFF","REELS","BONUS","PRIZE"];
const ALLOWED = new Set([...TARGETS, "CRANE","SLATE","AUDIO","ROUND","STONE","HEART","LIGHT",
  "PLANT","MONEY","POWER","TRUST","BRAVE","SHINE","GRAND","WORLD","DREAM","FLAME","SPARK","GHOST"]);

// deterministic-ish daily pick within a session
const DAY_INDEX = Math.floor(Date.now() / 86400000);
const targetFor = (offset = 0) => TARGETS[(DAY_INDEX + offset) % TARGETS.length];

// ---------- pack drop tables ----------
const ITEMS = {
  hint:    { key: "hint",    name: "Letter Hint",    icon: Lightbulb, color: C.gold,   desc: "Reveal one correct letter" },
  guess:   { key: "guess",   name: "Extra Guess",    icon: Plus,     color: C.blue,   desc: "+1 row this game" },
  mult:    { key: "mult",    name: "2x Multiplier",  icon: Zap,      color: C.purple, desc: "Doubles next win payout" },
  ticket:  { key: "ticket",  name: "Jackpot Ticket", icon: Ticket,   color: C.gold,   desc: "1 entry to the pool" },
  shield:  { key: "shield",  name: "Streak Shield",  icon: Shield,   color: C.green,  desc: "Protects a streak on a loss" },
  wild:    { key: "wild",    name: "Wildcard",       icon: Star,     color: C.purple, desc: "Auto-solves one letter" },
  badge:   { key: "badge",   name: "Neon Badge",     icon: Gem,      color: C.blue,   desc: "Cosmetic flex" },
};

// ---------- entry / payout (POINTS ONLY — real SOL is compliance-gated, see spec) ----------
// payout = entry * ROW_MULT[rowIndexSolved]. Note row 6 (idx5) returns 0.7x = a LOSS on a "win".
const ROW_MULT = { 0: 10, 1: 7, 2: 5.5, 3: 3.5, 4: 1.5, 5: 0.7 };
const ENTRY_TIERS = [100, 250, 500, 1000];
const REAL_MONEY_ENABLED = false; // ships false. do not flip without license + KYC + geofencing.

// ---------- wordle scoring (with dupes) ----------
function score(guess, target) {
  const res = Array(5).fill("absent");
  const t = target.split("");
  const counts = {};
  for (const ch of t) counts[ch] = (counts[ch] || 0) + 1;
  for (let i = 0; i < 5; i++) if (guess[i] === t[i]) { res[i] = "correct"; counts[guess[i]]--; }
  for (let i = 0; i < 5; i++) if (res[i] !== "correct" && counts[guess[i]] > 0) { res[i] = "present"; counts[guess[i]]--; }
  return res;
}

const shortAddr = (a) => a ? a.slice(0, 4) + "…" + a.slice(-4) : "";
const fakeAddr = () => "0x" + Math.random().toString(16).slice(2, 6) + "a9" + Math.random().toString(16).slice(2, 6);

// ============================================================
export default function App() {
  const phantom = usePhantom();          // real Phantom connection (window.solana)
  const wallet = phantom.address;
  const [view, setView] = useState("landing");
  const [coins, setCoins] = useState(2500);
  const [streak, setStreak] = useState(4);
  const [jackpot, setJackpot] = useState(48213);
  const [inv, setInv] = useState({ hint: 2, guess: 1, ticket: 3, shield: 1, mult: 1, wild: 0, badge: 1 });
  const [badges, setBadges] = useState(["First Spin", "Week Streak"]);
  const [history, setHistory] = useState([]); // {word, tries, won}
  const [predictions, setPredictions] = useState([]);
  const referral = "spinword.xyz/r/" + (wallet ? shortAddr(wallet).replace("…", "") : "DEGEN42");

  // ---- persist the off-chain $SPIN ledger locally (swap for Supabase in prod) ----
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem("spinword") || "null");
      if (s) { setCoins(s.coins); setStreak(s.streak); setInv(s.inv); setHistory(s.history || []); setBadges(s.badges || []); }
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem("spinword", JSON.stringify({ coins, streak, inv, history, badges })); } catch {}
  }, [coins, streak, inv, history, badges]);

  // jackpot ticker
  useEffect(() => {
    const id = setInterval(() => setJackpot((j) => j + Math.floor(Math.random() * 7) + 1), 900);
    return () => clearInterval(id);
  }, []);

  const addItem = (k, n = 1) => setInv((p) => ({ ...p, [k]: (p[k] || 0) + n }));
  const useItem = (k) => { setInv((p) => ({ ...p, [k]: Math.max(0, (p[k] || 0) - 1) })); };

  return (
    <div style={{ minHeight: "100vh", background: C.bg0, color: C.text,
      fontFamily: "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif", position: "relative", overflow: "hidden" }}>
      <Style />
      <CasinoBackdrop />
      {/* phone frame */}
      <div style={{ position: "relative", zIndex: 2, maxWidth: 468, margin: "0 auto", minHeight: "100vh",
        display: "flex", flexDirection: "column", boxShadow: "0 0 120px rgba(168,85,247,0.10)" }}>
        <TopBar coins={coins} jackpot={jackpot} wallet={wallet} onHome={() => setView("landing")} />
        <div style={{ flex: 1, padding: "0 14px 92px" }}>
          {view === "landing" && <Landing jackpot={jackpot} go={setView} />}
          {view === "game" && (
            <Game target={targetFor(0)} inv={inv} useItem={useItem} coins={coins} setCoins={setCoins}
              streak={streak} setStreak={setStreak} setJackpot={setJackpot}
              onFinish={(r) => { setHistory((h) => [r, ...h].slice(0, 30)); if (r.won) addItem("ticket", 1); }} />
          )}
          {view === "predict" && <Predict coins={coins} setCoins={setCoins} predictions={predictions} setPredictions={setPredictions} />}
          {view === "ranks" && <Leaderboard wallet={wallet} />}
          {view === "me" && <Profile phantom={phantom} coins={coins} streak={streak}
            inv={inv} badges={badges} history={history} referral={referral} />}
        </div>
        <NavBar view={view} setView={setView} />
      </div>
    </div>
  );
}

// ============================================================
// Ambient background
function CasinoBackdrop() {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none" }}>
      <div style={{ position: "absolute", inset: 0, background:
        `radial-gradient(1000px 600px at 15% -5%, rgba(168,85,247,0.28), transparent 60%),
         radial-gradient(900px 620px at 92% 0%, rgba(56,189,248,0.20), transparent 55%),
         radial-gradient(1100px 800px at 50% 115%, rgba(0,255,163,0.16), transparent 55%),
         linear-gradient(${C.bg1}, ${C.bg0})` }} />
      <div style={{ position: "absolute", inset: 0, opacity: 0.06, backgroundImage:
        "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
        backgroundSize: "44px 44px", maskImage: "radial-gradient(circle at 50% 40%, #000, transparent 78%)" }} />
      {[...Array(9)].map((_, i) => (
        <span key={i} style={{ position: "absolute", left: `${(i * 11 + 5) % 100}%`, top: "-8%",
          fontSize: 13 + (i % 3) * 5, opacity: 0.28, animation: `fall ${9 + (i % 5) * 2}s linear ${i * 1.3}s infinite` }}>🪙</span>
      ))}
    </div>
  );
}

// ============================================================
function TopBar({ coins, jackpot, wallet, onHome }) {
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 30, padding: "12px 14px 10px",
      ...glass, borderLeft: "none", borderRight: "none", borderTop: "none" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={onHome} style={{ ...btnReset, display: "flex", alignItems: "center", gap: 7 }}>
          <img src={LOGO} alt="SpinWord" style={{ height: 40, width: "auto", display: "block",
            filter: `drop-shadow(0 0 10px ${C.purple}77)` }} />
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          <Pill icon={<Coins size={13} color={C.gold} />} text={coins.toLocaleString()} />
          <Pill icon={<Wallet size={13} color={wallet ? C.green : C.dim} />} text={wallet ? shortAddr(wallet) : "Guest"} />
        </div>
      </div>
      <JackpotMeter jackpot={jackpot} />
    </div>
  );
}
function Pill({ icon, text }) {
  return (
    <div style={{ ...glass, borderRadius: 999, padding: "5px 10px", display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 700 }}>
      {icon}<span>{text}</span>
    </div>
  );
}
function JackpotMeter({ jackpot }) {
  return (
    <div style={{ marginTop: 10, ...glass, borderRadius: 14, padding: "8px 12px", position: "relative", overflow: "hidden",
      border: `1px solid ${C.gold}44` }}>
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, transparent, ${C.gold}22, transparent)`,
        animation: "shimmer 3.2s linear infinite" }} />
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Crown size={15} color={C.gold} />
          <span style={{ fontSize: 10.5, letterSpacing: 2, color: C.dim, fontWeight: 800 }}>DAILY JACKPOT</span>
        </div>
        <div style={{ fontSize: 19, fontWeight: 900, color: C.gold, textShadow: `0 0 14px ${C.gold}77`,
          fontVariantNumeric: "tabular-nums" }}>{jackpot.toLocaleString()} <span style={{ fontSize: 11, color: C.dim }}>$SPIN</span></div>
      </div>
    </div>
  );
}

// ============================================================
// LANDING
function Landing({ jackpot, go }) {
  return (
    <div style={{ paddingTop: 18 }}>
      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <img src={LOGO} alt="SpinWord" style={{ width: 168, maxWidth: "60%", margin: "2px auto 8px",
          display: "block", filter: `drop-shadow(0 0 30px ${C.purple}66)` }} />
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, ...glass, borderRadius: 999,
          padding: "5px 12px", fontSize: 11, fontWeight: 800, letterSpacing: 1, color: C.green, marginBottom: 14 }}>
          <span style={{ width: 7, height: 7, borderRadius: 99, background: C.green, boxShadow: `0 0 10px ${C.green}` }} />
          LIVE ON SOLANA · GUEST PLAY OPEN
        </div>
        <h1 style={{ fontSize: 40, lineHeight: 1.02, fontWeight: 900, margin: "0 0 10px", letterSpacing: -0.5 }}>
          Guess the word.<br />
          <span style={{ background: `linear-gradient(90deg, ${C.gold}, ${C.green}, ${C.purple})`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Spin the reels.</span><br />
          Hit the jackpot.
        </h1>
        <p style={{ color: C.dim, fontSize: 14.5, margin: "0 auto 18px", maxWidth: 330 }}>
          Wordle got rugged — the casino took over. A daily 5-letter mystery word, slot-reel reveals, and by-row multipliers.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <BigBtn primary onClick={() => go("game")}><Play size={17} /> Play Free</BigBtn>
          <BigBtn onClick={() => go("me")}><Wallet size={17} /> Connect Wallet</BigBtn>
        </div>
      </div>

      {/* mini demo reel */}
      <DemoReel />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, margin: "16px 0" }}>
        <StatCard big={jackpot.toLocaleString()} label="Live jackpot" color={C.gold} icon={<Crown size={16} color={C.gold} />} />
        <StatCard big="12,904" label="Degens playing" color={C.green} icon={<Users size={16} color={C.green} />} />
      </div>

      <SectionTitle>How it works</SectionTitle>
      <div style={{ display: "grid", gap: 8 }}>
        {[
          { i: <Dice5 size={17} color={C.blue} />, t: "Guess the daily word", d: "Six tries. Type a 5-letter word and hit spin." },
          { i: <Sparkles size={17} color={C.gold} />, t: "Watch the reels lock", d: "Green = exact. Gold = wrong spot. Dark = miss." },
          { i: <Coins size={17} color={C.purple} />, t: "Stake & multiply", d: "Stake $SPIN, win up to 10× for solving early." },
          { i: <Trophy size={17} color={C.green} />, t: "Climb the leaderboard", d: "Streaks, jackpots, and daily prize pools." },
        ].map((x, k) => (
          <div key={k} style={{ ...glass, borderRadius: 14, padding: 12, display: "flex", gap: 11, alignItems: "center" }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, ...glass, display: "grid", placeItems: "center", flexShrink: 0 }}>{x.i}</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{x.t}</div>
              <div style={{ color: C.dim, fontSize: 12.5 }}>{x.d}</div>
            </div>
          </div>
        ))}
      </div>

      <div onClick={() => go("game")} style={{ marginTop: 18, ...glass, borderRadius: 16, padding: 16, textAlign: "center",
        border: `1px solid ${C.gold}55`, cursor: "pointer", background: `linear-gradient(180deg, ${C.gold}18, rgba(255,255,255,0.03))` }}>
        <div style={{ fontWeight: 900, fontSize: 17 }}>Daily words. Daily loot. Daily degeneracy.</div>
        <div style={{ color: C.dim, fontSize: 13, marginTop: 3 }}>No wallet needed to start. Every letter could be your jackpot.</div>
        <div style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 5, color: C.gold, fontWeight: 800 }}>
          Enter the casino <ChevronRight size={16} />
        </div>
      </div>
    </div>
  );
}

function DemoReel() {
  const word = "SPINS";
  const st = ["correct", "present", "absent", "correct", "present"];
  return (
    <div style={{ display: "flex", gap: 7, justifyContent: "center" }}>
      {word.split("").map((ch, i) => (
        <div key={i} style={{ ...tileStyle(st[i]), width: 52, height: 52, fontSize: 24,
          animation: `pop 0.5s ${i * 0.09}s both` }}>{ch}</div>
      ))}
    </div>
  );
}
function StatCard({ big, label, color, icon }) {
  return (
    <div style={{ ...glass, borderRadius: 14, padding: 13 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>{icon}
        <span style={{ fontSize: 10.5, letterSpacing: 1, color: C.dim, fontWeight: 800, textTransform: "uppercase" }}>{label}</span></div>
      <div style={{ fontSize: 22, fontWeight: 900, color, fontVariantNumeric: "tabular-nums" }}>{big}</div>
    </div>
  );
}

// ============================================================
// GAME
function Game({ target, inv, useItem, coins, setCoins, streak, setStreak, setJackpot, onFinish }) {
  const MAX = 6;
  const [rows, setRows] = useState([]);          // committed {letters, states}
  const [cur, setCur] = useState("");
  const [maxRows, setMaxRows] = useState(MAX);
  const [reveal, setReveal] = useState(null);    // {word, states, tiles:[{mode,letter,status}]}
  const [status, setStatus] = useState("play");  // play|won|lost
  const [locked, setLocked] = useState([]);      // hint-revealed indices letters
  const [toast, setToast] = useState("");
  const [keyState, setKeyState] = useState({});
  const [multActive, setMultActive] = useState(false);
  const [entry, setEntry] = useState(250);       // $SPIN points staked this round
  const [staked, setStaked] = useState(false);   // entry deducted?
  const [lastWin, setLastWin] = useState(null);   // {payout, mult, rowIdx}
  const intervals = useRef([]);

  const done = status !== "play";
  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 1600); };

  const submit = useCallback(() => {
    if (done || reveal) return;
    if (cur.length !== 5) return showToast("Need 5 letters");
    if (!ALLOWED.has(cur) && !TARGETS.includes(cur)) { /* allow anyway for MVP */ }
    if (!staked) {
      if (coins < entry) return showToast("Not enough $SPIN for this entry");
      setCoins((c) => c - entry);
      setStaked(true);
    }
    const states = score(cur, target);
    // start slot reveal
    const tiles = cur.split("").map((l) => ({ mode: "spin", letter: "?", status: "absent", final: l }));
    setReveal({ word: cur, states, tiles });
    // spin animation
    intervals.current.forEach(clearInterval);
    intervals.current = [];
    const spinId = setInterval(() => {
      setReveal((r) => r && ({ ...r, tiles: r.tiles.map((t) =>
        t.mode === "spin" ? { ...t, letter: "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)] } : t) }));
    }, 55);
    intervals.current.push(spinId);
    cur.split("").forEach((l, i) => {
      const to = setTimeout(() => {
        setReveal((r) => {
          if (!r) return r;
          const tiles = r.tiles.slice();
          tiles[i] = { mode: "locked", letter: l, status: states[i], final: l };
          return { ...r, tiles };
        });
      }, 520 + i * 300);
      intervals.current.push(to);
    });
    // finalize
    const finTo = setTimeout(() => {
      clearInterval(spinId);
      const newRows = [...rows, { letters: cur.split(""), states }];
      setRows(newRows);
      setReveal(null);
      setCur("");
      // key colors
      setKeyState((ks) => {
        const n = { ...ks };
        cur.split("").forEach((l, i) => {
          const s = states[i];
          const rank = { absent: 0, present: 1, correct: 2 };
          if (rank[s] >= rank[n[l] ?? -1]) n[l] = s;
        });
        return n;
      });
      const won = states.every((s) => s === "correct");
      if (won) {
        const rowIdx = newRows.length - 1;
        const m = (ROW_MULT[rowIdx] ?? 0.5) * (multActive ? 2 : 1);
        const payout = Math.round(entry * m);
        setCoins((c) => c + payout);
        setStreak((s) => s + 1);
        setJackpot((j) => j + 250);
        setLastWin({ payout, mult: m, rowIdx });
        setStatus("won");
        setMultActive(false);
        onFinish({ word: target, tries: newRows.length, won: true });
      } else if (newRows.length >= maxRows) {
        // streak shield?
        if (inv.shield > 0) { useItem("shield"); showToast("🛡️ Streak Shield used — streak saved!"); }
        else setStreak(0);
        setStatus("lost");
        onFinish({ word: target, tries: newRows.length, won: false });
      }
    }, 520 + 5 * 300 + 120);
    intervals.current.push(finTo);
  }, [cur, done, reveal, rows, target, maxRows, multActive, inv.shield, entry, staked, coins]);

  useEffect(() => () => intervals.current.forEach(clearInterval), []);

  // keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (done || reveal) return;
      if (e.key === "Enter") submit();
      else if (e.key === "Backspace") setCur((c) => c.slice(0, -1));
      else if (/^[a-zA-Z]$/.test(e.key)) setCur((c) => (c.length < 5 ? c + e.key.toUpperCase() : c));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submit, done, reveal]);

  const tapKey = (k) => {
    if (done || reveal) return;
    if (k === "ENTER") submit();
    else if (k === "DEL") setCur((c) => c.slice(0, -1));
    else setCur((c) => (c.length < 5 ? c + k : c));
  };

  // items
  const useHint = () => {
    if (inv.hint <= 0 || done) return;
    const open = [...target].map((l, i) => i).filter((i) => !locked.includes(i));
    if (!open.length) return;
    const idx = open[Math.floor(Math.random() * open.length)];
    setLocked((l) => [...l, idx]); useItem("hint");
    showToast(`💡 Position ${idx + 1} is “${target[idx]}”`);
  };
  const useExtra = () => { if (inv.guess <= 0 || done) return; useItem("guess"); setMaxRows((m) => m + 1); showToast("➕ Extra guess added"); };
  const useMult = () => { if (inv.mult <= 0 || done || multActive) return; useItem("mult"); setMultActive(true); showToast("⚡ 2x multiplier armed"); };

  const gridRows = [];
  for (let r = 0; r < maxRows; r++) {
    if (r < rows.length) gridRows.push({ type: "done", data: rows[r] });
    else if (r === rows.length && reveal) gridRows.push({ type: "reveal", data: reveal });
    else if (r === rows.length) gridRows.push({ type: "cur" });
    else gridRows.push({ type: "empty" });
  }

  return (
    <div style={{ paddingTop: 14 }}>
      <Countdown />

      {/* ENTRY + REWARD TABLE (points-only demo of the real-money loop) */}
      <EntryPanel entry={entry} setEntry={setEntry} staked={staked} coins={coins}
        rowsPlayed={rows.length} lastWin={lastWin} multActive={multActive} />

      {/* item bar */}
      <div style={{ display: "flex", gap: 7, margin: "12px 0 6px" }}>
        <ItemBtn item={ITEMS.hint} n={inv.hint} onClick={useHint} />
        <ItemBtn item={ITEMS.guess} n={inv.guess} onClick={useExtra} />
        <ItemBtn item={ITEMS.mult} n={inv.mult} onClick={useMult} active={multActive} />
        <ItemBtn item={ITEMS.shield} n={inv.shield} onClick={() => showToast("🛡️ Auto-guards a loss")} />
      </div>
      {locked.length > 0 && (
        <div style={{ fontSize: 11.5, color: C.gold, textAlign: "center", marginBottom: 6 }}>
          Hint{locked.length > 1 ? "s" : ""}: {locked.sort((a, b) => a - b).map((i) => `#${i + 1}=${target[i]}`).join("  ")}
        </div>
      )}

      {/* board */}
      <div style={{ display: "grid", gap: 7, justifyContent: "center", margin: "6px 0 12px" }}>
        {gridRows.map((row, ri) => (
          <div key={ri} style={{ display: "flex", gap: 7 }}>
            {[0, 1, 2, 3, 4].map((ci) => {
              if (row.type === "done")
                return <Tile key={ci} letter={row.data.letters[ci]} status={row.data.states[ci]} revealDelay={ci * 0.06} />;
              if (row.type === "reveal") {
                const t = row.data.tiles[ci];
                return <Tile key={ci} letter={t.letter} status={t.mode === "locked" ? t.status : "spin"} spinning={t.mode === "spin"} />;
              }
              if (row.type === "cur") {
                const hintLetter = locked.includes(ci) ? target[ci] : "";
                return <Tile key={ci} letter={cur[ci] || hintLetter} status={cur[ci] ? "typed" : hintLetter ? "hint" : "empty"} />;
              }
              return <Tile key={ci} letter="" status="empty" />;
            })}
          </div>
        ))}
      </div>

      {toast && <div style={{ textAlign: "center", ...glass, borderRadius: 10, padding: "7px 12px", fontSize: 13, fontWeight: 700, margin: "0 auto 10px", maxWidth: 300 }}>{toast}</div>}

      {/* keyboard */}
      {!done && <Keyboard onKey={tapKey} keyState={keyState} disabled={!!reveal} multActive={multActive} />}

      {status === "won" && <WinModal target={target} tries={rows.length} entry={entry} win={lastWin} />}
      {status === "lost" && <LoseModal target={target} rows={rows} entry={entry} />}
    </div>
  );
}

// entry stake + by-row reward table
function EntryPanel({ entry, setEntry, staked, coins, rowsPlayed, lastWin, multActive }) {
  return (
    <div style={{ ...glass, borderRadius: 14, padding: 12, marginTop: 10, border: `1px solid ${C.gold}33` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Coins size={14} color={C.gold} />
          <span style={{ fontWeight: 800, fontSize: 12.5 }}>Degen Entry</span>
          <span style={{ fontSize: 10, color: C.dim, fontWeight: 700 }}>$SPIN points</span>
        </div>
        {staked
          ? <span style={{ fontSize: 11.5, color: C.green, fontWeight: 800 }}>Staked {entry} · live</span>
          : <span style={{ fontSize: 11, color: C.dim }}>set stake, then guess</span>}
      </div>
      {!staked && (
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {ENTRY_TIERS.map((t) => (
            <button key={t} onClick={() => setEntry(t)} disabled={t > coins} style={{ ...btnReset, flex: 1, padding: "8px 0",
              borderRadius: 9, fontWeight: 800, fontSize: 12.5, cursor: t > coins ? "default" : "pointer", opacity: t > coins ? 0.4 : 1,
              color: entry === t ? "#150e26" : C.text,
              background: entry === t ? `linear-gradient(90deg,${C.gold},${C.green})` : "rgba(255,255,255,0.05)",
              border: entry === t ? "none" : "1px solid rgba(255,255,255,0.1)" }}>{t}</button>
          ))}
        </div>
      )}
      {/* reward ladder */}
      <div style={{ display: "flex", gap: 4 }}>
        {Object.entries(ROW_MULT).map(([idx, m]) => {
          const i = Number(idx);
          const active = rowsPlayed === i && !lastWin;
          const hit = lastWin && lastWin.rowIdx === i;
          const win = m >= 1;
          return (
            <div key={idx} style={{ flex: 1, textAlign: "center", borderRadius: 8, padding: "6px 2px",
              background: hit ? `${C.gold}33` : active ? "rgba(255,255,255,0.06)" : "transparent",
              border: hit ? `1px solid ${C.gold}` : active ? `1px solid ${C.purple}66` : "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: 9, color: C.dim, fontWeight: 700 }}>R{i + 1}</div>
              <div style={{ fontSize: 13, fontWeight: 900, color: win ? C.green : "#e0975a" }}>{m}×</div>
              <div style={{ fontSize: 8.5, color: C.dim }}>{Math.round(entry * m)}</div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 10, color: "#e0975a", textAlign: "center", marginTop: 7 }}>
        ⚠︎ Row 6 pays 0.7× — solving late returns less than you staked{multActive ? " · 2× armed" : ""}
      </div>
    </div>
  );
}

function Tile({ letter, status, spinning, revealDelay = 0 }) {
  const s = tileStyle(status);
  return (
    <div style={{ ...s, width: 52, height: 52, fontSize: 24, position: "relative", overflow: "hidden",
      animation: (status === "correct" || status === "present" || status === "absent") && !spinning
        ? `flip 0.5s ${revealDelay}s both` : undefined }}>
      <span style={{ animation: spinning ? "reelBlur 0.09s linear infinite" : (status === "typed" ? "pop 0.12s" : undefined),
        filter: spinning ? "blur(0.6px)" : "none" }}>{letter}</span>
      {spinning && <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(255,255,255,0.14), transparent 30%, transparent 70%, rgba(0,0,0,0.35))" }} />}
    </div>
  );
}
function tileStyle(status) {
  const base = { borderRadius: 11, display: "grid", placeItems: "center", fontWeight: 900, color: "#fff",
    border: "1.5px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.03)", userSelect: "none" };
  if (status === "correct") return { ...base, background: `linear-gradient(180deg, ${C.green}, ${C.greenDeep})`, border: `1.5px solid ${C.green}`, boxShadow: `0 0 20px ${C.green}66`, color: "#06231a" };
  if (status === "present") return { ...base, background: `linear-gradient(180deg, ${C.gold}, ${C.goldDeep})`, border: `1.5px solid ${C.gold}`, boxShadow: `0 0 20px ${C.gold}55`, color: "#241800" };
  if (status === "absent") return { ...base, background: C.slate, border: `1.5px solid ${C.slateEdge}`, color: "#8b81a8" };
  if (status === "typed") return { ...base, border: `1.5px solid ${C.purple}`, boxShadow: `0 0 14px ${C.purple}44` };
  if (status === "hint") return { ...base, border: `1.5px dashed ${C.gold}`, color: `${C.gold}`, background: `${C.gold}12` };
  if (status === "spin") return { ...base, background: "linear-gradient(180deg,#2a2140,#181026)", border: `1.5px solid ${C.purple}88` };
  return base;
}

function Countdown() {
  const [t, setT] = useState("");
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const end = new Date(now); end.setUTCHours(24, 0, 0, 0);
      const d = end - now, h = Math.floor(d / 3.6e6), m = Math.floor((d % 3.6e6) / 6e4), s = Math.floor((d % 6e4) / 1e3);
      setT(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, []);
  return (
    <div style={{ ...glass, borderRadius: 12, padding: "9px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Dice5 size={15} color={C.purple} />
        <span style={{ fontWeight: 800, fontSize: 13 }}>Today's Mystery Word</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, color: C.dim, fontSize: 13, fontWeight: 700 }}>
        <Clock size={13} /> <span style={{ fontVariantNumeric: "tabular-nums", color: C.text }}>{t}</span>
      </div>
    </div>
  );
}

function ItemBtn({ item, n, onClick, active }) {
  const I = item.icon; const off = n <= 0;
  return (
    <button onClick={onClick} disabled={off} style={{ ...btnReset, flex: 1, ...glass, borderRadius: 12, padding: "8px 4px",
      opacity: off ? 0.4 : 1, position: "relative", border: active ? `1.5px solid ${item.color}` : glass.border,
      boxShadow: active ? `0 0 16px ${item.color}66` : "none", cursor: off ? "default" : "pointer" }}>
      <I size={17} color={item.color} />
      <div style={{ fontSize: 9.5, color: C.dim, fontWeight: 700, marginTop: 2 }}>{item.name.split(" ")[0]}</div>
      <span style={{ position: "absolute", top: -6, right: -4, background: item.color, color: "#150e26", borderRadius: 99,
        minWidth: 17, height: 17, fontSize: 10.5, fontWeight: 900, display: "grid", placeItems: "center", padding: "0 3px" }}>{n}</span>
    </button>
  );
}

function Keyboard({ onKey, keyState, disabled, multActive }) {
  const rows = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
  const kcol = (s) => s === "correct" ? C.green : s === "present" ? C.gold : s === "absent" ? C.slate : "rgba(255,255,255,0.07)";
  return (
    <div style={{ display: "grid", gap: 6, opacity: disabled ? 0.55 : 1 }}>
      <button onClick={() => onKey("ENTER")} style={{ ...btnReset, ...glass, borderRadius: 11, padding: "11px",
        fontWeight: 900, letterSpacing: 2, fontSize: 14, color: "#150e26",
        background: `linear-gradient(90deg, ${C.gold}, ${C.green})`, boxShadow: `0 0 18px ${C.green}44` }}>
        {multActive ? "⚡ SPIN REVEAL (2x)" : "SPIN REVEAL"}
      </button>
      {rows.map((r, ri) => (
        <div key={ri} style={{ display: "flex", gap: 5, justifyContent: "center" }}>
          {ri === 2 && <Key onClick={() => onKey("DEL")} wide>⌫</Key>}
          {r.split("").map((k) => (
            <Key key={k} onClick={() => onKey(k)} bg={kcol(keyState[k])}>{k}</Key>
          ))}
        </div>
      ))}
    </div>
  );
}
function Key({ children, onClick, wide, bg }) {
  return (
    <button onClick={onClick} style={{ ...btnReset, flex: wide ? 1.6 : 1, minWidth: 0, height: 44, borderRadius: 9,
      fontWeight: 800, fontSize: 15, color: "#fff", background: bg || "rgba(255,255,255,0.07)",
      border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}>{children}</button>
  );
}

// ---- win / lose ----
function WinModal({ target, tries, entry, win }) {
  const [show, setShow] = useState(true);
  const payout = win ? win.payout : entry;
  const m = win ? win.mult : 1;
  const net = payout - entry;
  const profit = net >= 0;
  if (!show) return null;
  return (
    <Modal onClose={() => setShow(false)}>
      <CoinBurst />
      <div style={{ textAlign: "center", position: "relative" }}>
        <div style={{ fontSize: 12, letterSpacing: 3, color: C.gold, fontWeight: 900 }}>★ SOLVED ON ROW {tries} ★</div>
        <div style={{ fontSize: 34, fontWeight: 900, margin: "6px 0", background: `linear-gradient(90deg,${C.gold},${C.green})`,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{m}× PAYOUT</div>
        <div style={{ display: "flex", gap: 7, justifyContent: "center", margin: "10px 0" }}>
          {target.split("").map((c, i) => (
            <div key={i} style={{ ...tileStyle("correct"), width: 46, height: 46, fontSize: 22, animation: `pop .4s ${i * 0.08}s both` }}>{c}</div>
          ))}
        </div>
        <div style={{ ...glass, borderRadius: 12, padding: 12, margin: "10px 0" }}>
          <div style={{ fontSize: 12, color: C.dim, fontWeight: 700 }}>{entry} staked · {m}× multiplier</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: C.gold }}>+{payout.toLocaleString()} $SPIN</div>
          <div style={{ fontSize: 12, color: profit ? C.green : "#e0975a", marginTop: 2 }}>
            {profit ? `Net +${net.toLocaleString()}` : `Net ${net.toLocaleString()} — solved too late to profit`} · +1 Jackpot Ticket
          </div>
        </div>
        <ShareRow target={target} tries={tries} won />
        <button onClick={() => setShow(false)} style={{ ...btnReset, marginTop: 10, color: C.dim, fontSize: 13, cursor: "pointer" }}>Come back tomorrow →</button>
      </div>
    </Modal>
  );
}
function LoseModal({ target, rows, entry }) {
  const [show, setShow] = useState(true);
  if (!show) return null;
  return (
    <Modal onClose={() => setShow(false)}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 12, letterSpacing: 3, color: C.dim, fontWeight: 900 }}>HOUSE WINS THIS ROUND</div>
        <div style={{ fontSize: 30, fontWeight: 900, margin: "8px 0" }}>−{(entry || 0).toLocaleString()} $SPIN</div>
        <div style={{ fontSize: 13, color: C.dim }}>The word was</div>
        <div style={{ display: "flex", gap: 7, justifyContent: "center", margin: "10px 0" }}>
          {target.split("").map((c, i) => (
            <div key={i} style={{ ...tileStyle("present"), width: 46, height: 46, fontSize: 22 }}>{c}</div>
          ))}
        </div>
        <div style={{ ...glass, borderRadius: 12, padding: 12, fontSize: 13, color: C.dim }}>
          Out of guesses? Spend a <b style={{ color: C.gold }}>Letter Hint</b> or <b style={{ color: C.blue }}>Extra Guess</b> earlier, or arm a <b style={{ color: C.green }}>Streak Shield</b> next round.
        </div>
        <ShareRow target={target} tries={rows.length} won={false} />
        <button onClick={() => setShow(false)} style={{ ...btnReset, marginTop: 10, color: C.dim, fontSize: 13, cursor: "pointer" }}>Close</button>
      </div>
    </Modal>
  );
}

function ShareRow({ target, tries, won }) {
  const [copied, setCopied] = useState(false);
  const grid = won
    ? Array(tries).fill("🟨🟨🟩🟩🟨").slice(0, tries - 1).concat("🟩🟩🟩🟩🟩")
    : ["⬛🟨⬛🟩⬛", "🟨🟩⬛⬛🟨", "⬛🟩🟩🟨⬛"];
  const text = `SPINWORD 🎰 ${won ? `${tries}/6` : "X/6"}\n${grid.join("\n")}\nSpin the reels 👉 spinword.xyz/r/DEGEN42`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); } catch {}
    setCopied(true); setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div>
      <div style={{ ...glass, borderRadius: 10, padding: 10, fontSize: 13, lineHeight: 1.5, textAlign: "left", whiteSpace: "pre-wrap", fontFamily: "monospace" }}>{text}</div>
      <button onClick={copy} style={{ ...btnReset, marginTop: 8, width: "100%", ...glass, borderRadius: 11, padding: 11,
        fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, cursor: "pointer",
        border: `1px solid ${C.green}55`, color: C.green }}>
        {copied ? <><Check size={16} /> Copied — paste to X</> : <><Share2 size={16} /> Share result on X</>}
      </button>
    </div>
  );
}

// ============================================================
// PREDICT (future words, in-game coins only)
function Predict({ coins, setCoins, predictions, setPredictions }) {
  const [day, setDay] = useState(1);
  const [word, setWord] = useState("");
  const [stake, setStake] = useState(100);
  const place = () => {
    if (word.length !== 5) return;
    if (stake > coins) return;
    setCoins((c) => c - stake);
    setPredictions((p) => [{ day, word: word.toUpperCase(), stake, id: Date.now() }, ...p]);
    setWord("");
  };
  return (
    <div style={{ paddingTop: 16 }}>
      <SectionTitle>Predict future words</SectionTitle>
      <div style={{ ...glass, borderRadius: 12, padding: 11, fontSize: 12.5, color: C.dim, marginBottom: 12,
        border: `1px solid ${C.blue}44` }}>
        <b style={{ color: C.blue }}>Free-play mode.</b> Stake in-game $SPIN coins on what you think an upcoming daily word will be, up to 7 days out. Real-crypto wagering is disabled pending compliance review.
      </div>
      <div style={{ ...glass, borderRadius: 16, padding: 14 }}>
        <div style={{ fontSize: 11, color: C.dim, fontWeight: 800, letterSpacing: 1, marginBottom: 6 }}>PICK A DAY</div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <button key={d} onClick={() => setDay(d)} style={{ ...btnReset, minWidth: 46, padding: "9px 0", borderRadius: 10,
              fontWeight: 800, flexShrink: 0, cursor: "pointer",
              background: day === d ? `linear-gradient(180deg,${C.purple},#6d28d9)` : "rgba(255,255,255,0.05)",
              border: day === d ? `1px solid ${C.purple}` : "1px solid rgba(255,255,255,0.08)" }}>
              +{d}d
            </button>
          ))}
        </div>
        <input value={word} onChange={(e) => setWord(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5))}
          placeholder="YOUR 5-LETTER PREDICTION" style={{ marginTop: 12, width: "100%", boxSizing: "border-box",
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 11, padding: 12,
            color: C.text, fontWeight: 900, letterSpacing: 4, textAlign: "center", fontSize: 18, outline: "none" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
          <input type="range" min="50" max={Math.max(50, coins)} step="50" value={stake}
            onChange={(e) => setStake(Number(e.target.value))} style={{ flex: 1, accentColor: C.gold }} />
          <div style={{ ...glass, borderRadius: 9, padding: "6px 10px", fontWeight: 900, color: C.gold, minWidth: 78, textAlign: "center" }}>
            {stake} $SPIN</div>
        </div>
        <button onClick={place} disabled={word.length !== 5 || stake > coins}
          style={{ ...btnReset, width: "100%", marginTop: 12, borderRadius: 12, padding: 13, fontWeight: 900, fontSize: 15,
            cursor: word.length === 5 ? "pointer" : "default", color: "#150e26",
            background: word.length === 5 ? `linear-gradient(90deg,${C.gold},${C.green})` : "rgba(255,255,255,0.08)",
            opacity: word.length === 5 && stake <= coins ? 1 : 0.5 }}>
          Lock prediction · potential 12x
        </button>
      </div>

      {predictions.length > 0 && (
        <>
          <SectionTitle>Your open predictions</SectionTitle>
          <div style={{ display: "grid", gap: 8 }}>
            {predictions.map((p) => (
              <div key={p.id} style={{ ...glass, borderRadius: 12, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 900, letterSpacing: 3, fontSize: 16 }}>{p.word}</div>
                  <div style={{ fontSize: 11.5, color: C.dim }}>Resolves in +{p.day} day{p.day > 1 ? "s" : ""}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: C.gold, fontWeight: 900 }}>{p.stake} $SPIN</div>
                  <div style={{ fontSize: 11, color: C.blue, fontWeight: 700 }}>PENDING</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// LEADERBOARD
const LB = {
  daily: [["0x9f3aa9c21b", 4820, "🥇 12,000"], ["0x1c40a94e2d", 4110, "🥈 6,000"], ["0x77b2a9f3c1", 3940, "🥉 3,000"],
    ["0xDEGEN42you", 3610, "1,200"], ["0x5a1ea9d0f2", 3200, "900"], ["0xbe9aa9c447", 2980, "700"], ["0x0f3aa91b8e", 2740, "500"]],
  weekly: [["0x1c40a94e2d", 28110, "🥇 60,000"], ["0x9f3aa9c21b", 26400, "🥈 30,000"], ["0xDEGEN42you", 24950, "🥉 15,000"],
    ["0x77b2a9f3c1", 21200, "6,000"], ["0xaa02a9ffe1", 19800, "4,000"]],
  streaks: [["0x77b2a9f3c1", 41, "🔥 41 days"], ["0x9f3aa9c21b", 33, "🔥 33 days"], ["0xDEGEN42you", 4, "🔥 4 days"],
    ["0x1c40a94e2d", 3, "🔥 3 days"]],
  wins: [["0x5a1ea9d0f2", 48213, "💰 48,213"], ["0x9f3aa9c21b", 22100, "💰 22,100"], ["0x77b2a9f3c1", 18400, "💰 18,400"],
    ["0xDEGEN42you", 9800, "💰 9,800"]],
};
function Leaderboard({ wallet }) {
  const [tab, setTab] = useState("daily");
  const you = wallet ? shortAddr(wallet) : "0xDEGEN42you";
  const tabs = { daily: "Daily", weekly: "Weekly", streaks: "Streaks", wins: "Biggest Wins" };
  return (
    <div style={{ paddingTop: 16 }}>
      <SectionTitle>Leaderboard</SectionTitle>
      <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto", paddingBottom: 2 }}>
        {Object.entries(tabs).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} style={{ ...btnReset, padding: "7px 13px", borderRadius: 999, fontWeight: 800,
            fontSize: 12.5, flexShrink: 0, cursor: "pointer", color: tab === k ? "#150e26" : C.dim,
            background: tab === k ? `linear-gradient(90deg,${C.gold},${C.green})` : "rgba(255,255,255,0.05)" }}>{label}</button>
        ))}
      </div>
      <div style={{ ...glass, borderRadius: 16, padding: 6 }}>
        {LB[tab].map(([addr, score, prize], i) => {
          const isYou = addr.includes("DEGEN42") || addr === you;
          const medal = ["#ffcf3f", "#c9d3e0", "#e0975a"][i];
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 12px", borderRadius: 12,
              background: isYou ? `${C.purple}22` : "transparent", border: isYou ? `1px solid ${C.purple}66` : "1px solid transparent",
              marginBottom: 3 }}>
              <div style={{ width: 26, textAlign: "center", fontWeight: 900, fontSize: 15,
                color: i < 3 ? medal : C.dim, textShadow: i < 3 ? `0 0 10px ${medal}` : "none" }}>{i + 1}</div>
              <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                background: `conic-gradient(from ${i * 60}deg, ${C.purple}, ${C.blue}, ${C.green}, ${C.gold})`, opacity: 0.85 }} />
              <div style={{ flex: 1, fontWeight: 800, fontSize: 13.5, fontFamily: "monospace" }}>
                {isYou ? <span style={{ color: C.purple }}>{shortAddr(addr)} · you</span> : shortAddr(addr)}
              </div>
              <div style={{ fontVariantNumeric: "tabular-nums", fontSize: 13, color: C.dim, marginRight: 8 }}>{score.toLocaleString()}</div>
              <div style={{ fontWeight: 900, fontSize: 13, color: C.gold, minWidth: 62, textAlign: "right" }}>{prize}</div>
            </div>
          );
        })}
      </div>
      <div style={{ textAlign: "center", color: C.dim, fontSize: 12, marginTop: 12 }}>Pools settle daily at 00:00 UTC · paid in $SPIN</div>
    </div>
  );
}

// ============================================================
// PROFILE
function Profile({ phantom, coins, streak, inv, badges, history, referral }) {
  const wallet = phantom.address;
  const [copied, setCopied] = useState(false);
  const connect = () => { wallet ? phantom.disconnect() : phantom.connect(); };
  const copyRef = async () => { try { await navigator.clipboard.writeText("https://" + referral); } catch {}; setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const totalItems = Object.values(inv).reduce((a, b) => a + b, 0);

  return (
    <div style={{ paddingTop: 16 }}>
      <div style={{ ...glass, borderRadius: 18, padding: 16, textAlign: "center",
        background: `linear-gradient(160deg, ${C.purple}18, rgba(255,255,255,0.03))` }}>
        <div style={{ width: 66, height: 66, borderRadius: 18, margin: "0 auto 10px",
          background: `conic-gradient(from 120deg, ${C.gold}, ${C.green}, ${C.purple}, ${C.blue}, ${C.gold})`,
          display: "grid", placeItems: "center", fontWeight: 900, fontSize: 26, color: "#150e26",
          boxShadow: `0 0 26px ${C.purple}55` }}>{wallet ? "◎" : "👤"}</div>
        <div style={{ fontWeight: 900, fontSize: 17, fontFamily: "monospace" }}>{wallet ? shortAddr(wallet) : "Guest Degen"}</div>
        <div style={{ fontSize: 12, color: C.dim }}>
          {phantom.error ? phantom.error
            : wallet ? "Phantom connected · Solana" : "Playing as guest — connect Phantom to save progress"}</div>
        {wallet && (
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 10 }}>
            <Pill icon={<Coins size={13} color={C.gold} />} text={`${phantom.spinBalance ?? "—"} $SPIN`} />
            <Pill icon={<Sparkles size={13} color={C.green} />} text={`${phantom.solBalance ?? "—"} SOL`} />
          </div>
        )}
        <button onClick={connect} style={{ ...btnReset, marginTop: 12, borderRadius: 12, padding: "11px 20px", fontWeight: 900,
          cursor: "pointer", color: wallet ? C.dim : "#150e26",
          background: wallet ? "rgba(255,255,255,0.06)" : `linear-gradient(90deg,#ab9ff2,${C.purple})` }}>
          {phantom.connecting ? "Connecting…" : wallet ? "Disconnect" : <span style={{ display: "inline-flex", gap: 7, alignItems: "center" }}><Wallet size={16} /> Connect Phantom</span>}
        </button>
      </div>

      {/* real-money entries: compliance-gated, ships OFF */}
      <div style={{ ...glass, borderRadius: 14, padding: 13, marginTop: 12, border: `1px solid ${C.gold}33` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
          <Shield size={15} color={C.gold} />
          <span style={{ fontWeight: 800, fontSize: 13 }}>On-chain $SPIN entries</span>
          <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 900, letterSpacing: 1, color: "#e0975a",
            background: "rgba(224,151,90,0.14)", borderRadius: 999, padding: "3px 8px" }}>LOCKED</span>
        </div>
        <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.5 }}>
          Staking real $SPIN for multiplied payouts is disabled (<code>REAL_MONEY_ENABLED=false</code>). It requires a gaming
          license, KYC/AML, geofencing, and an audited escrow program. Until then, entries run on off-chain $SPIN points. See <b style={{ color: C.gold }}>COMPLIANCE.md</b>.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 12 }}>
        <MiniStat icon={<Coins size={16} color={C.gold} />} val={coins.toLocaleString()} label="$SPIN" />
        <MiniStat icon={<Flame size={16} color={C.green} />} val={streak} label="Day streak" />
        <MiniStat icon={<Gift size={16} color={C.purple} />} val={totalItems} label="Items" />
      </div>

      <SectionTitle>Badges</SectionTitle>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {badges.map((b) => (
          <div key={b} style={{ ...glass, borderRadius: 999, padding: "7px 13px", fontSize: 12.5, fontWeight: 800,
            display: "flex", alignItems: "center", gap: 6, border: `1px solid ${C.gold}44` }}>
            <Gem size={13} color={C.gold} /> {b}</div>
        ))}
        <div style={{ ...glass, borderRadius: 999, padding: "7px 13px", fontSize: 12.5, fontWeight: 800, color: C.dim, opacity: 0.6 }}>+ more to unlock</div>
      </div>

      <SectionTitle>Referral — earn bonus $SPIN per invite</SectionTitle>
      <div style={{ ...glass, borderRadius: 13, padding: 12, display: "flex", alignItems: "center", gap: 10,
        border: `1px solid ${C.green}44` }}>
        <div style={{ flex: 1, fontFamily: "monospace", fontSize: 13, color: C.green, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{referral}</div>
        <button onClick={copyRef} style={{ ...btnReset, borderRadius: 9, padding: "8px 12px", fontWeight: 800, fontSize: 12.5,
          cursor: "pointer", color: "#150e26", background: `linear-gradient(90deg,${C.green},${C.blue})`, display: "flex", gap: 5, alignItems: "center" }}>
          {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}</button>
      </div>

      <SectionTitle>Recent games</SectionTitle>
      {history.length === 0 ? (
        <div style={{ ...glass, borderRadius: 13, padding: 16, textAlign: "center", color: C.dim, fontSize: 13 }}>
          No games yet. Hit <b style={{ color: C.gold }}>Play</b> and spin your first word.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 7 }}>
          {history.slice(0, 6).map((h, i) => (
            <div key={i} style={{ ...glass, borderRadius: 11, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 900, letterSpacing: 3, fontFamily: "monospace" }}>{h.word}</span>
              <span style={{ fontWeight: 800, fontSize: 12.5, color: h.won ? C.green : C.dim }}>
                {h.won ? `WON · ${h.tries}/6` : "MISSED"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function MiniStat({ icon, val, label }) {
  return (
    <div style={{ ...glass, borderRadius: 13, padding: "12px 6px", textAlign: "center" }}>
      <div style={{ marginBottom: 3 }}>{icon}</div>
      <div style={{ fontWeight: 900, fontSize: 17 }}>{val}</div>
      <div style={{ fontSize: 10.5, color: C.dim, fontWeight: 700 }}>{label}</div>
    </div>
  );
}

// ============================================================
// shared bits
function NavBar({ view, setView }) {
  const items = [
    { k: "landing", label: "Home", icon: Home },
    { k: "game", label: "Play", icon: Dice5 },
    { k: "predict", label: "Predict", icon: TrendingUp },
    { k: "ranks", label: "Ranks", icon: Trophy },
    { k: "me", label: "Me", icon: Crown },
  ];
  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 40 }}>
      <div style={{ maxWidth: 468, margin: "0 auto", ...glass, borderTop: "1px solid rgba(255,255,255,0.10)",
        display: "flex", padding: "8px 6px calc(8px + env(safe-area-inset-bottom))" }}>
        {items.map((it) => {
          const I = it.icon; const on = view === it.k;
          return (
            <button key={it.k} onClick={() => setView(it.k)} style={{ ...btnReset, flex: 1, padding: "5px 0", cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <I size={20} color={on ? C.gold : C.dim} style={{ filter: on ? `drop-shadow(0 0 8px ${C.gold})` : "none" }} />
              <span style={{ fontSize: 10, fontWeight: 800, color: on ? C.text : C.dim }}>{it.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
function SectionTitle({ children }) {
  return <div style={{ fontSize: 12, letterSpacing: 2, fontWeight: 900, color: C.dim, textTransform: "uppercase", margin: "20px 2px 10px" }}>{children}</div>;
}
function BigBtn({ children, primary, onClick }) {
  return (
    <button onClick={onClick} style={{ ...btnReset, display: "inline-flex", alignItems: "center", gap: 7, padding: "13px 20px",
      borderRadius: 13, fontWeight: 900, fontSize: 15, cursor: "pointer",
      color: primary ? "#150e26" : C.text,
      background: primary ? `linear-gradient(90deg, ${C.gold}, ${C.green})` : "rgba(255,255,255,0.06)",
      border: primary ? "none" : "1px solid rgba(255,255,255,0.14)",
      boxShadow: primary ? `0 0 24px ${C.green}44` : "none" }}>{children}</button>
  );
}
function ChestGlyph({ color, big }) {
  const s = big ? 46 : 38;
  return (
    <div style={{ width: s, height: s, borderRadius: 12, position: "relative", flexShrink: 0,
      background: `linear-gradient(180deg, ${color}, ${color}66)`, boxShadow: `0 0 18px ${color}55`,
      display: "grid", placeItems: "center" }}>
      <Gift size={big ? 24 : 20} color="#150e26" />
    </div>
  );
}
function Modal({ children, onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(5,3,12,0.78)",
      backdropFilter: "blur(6px)", display: "grid", placeItems: "center", padding: 20, animation: "fade .2s" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 380, ...glass, borderRadius: 22, padding: 20,
        border: "1px solid rgba(255,255,255,0.16)", boxShadow: "0 20px 80px rgba(0,0,0,0.6)", position: "relative", animation: "popIn .3s" }}>
        {children}
      </div>
    </div>
  );
}
function CoinBurst() {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", borderRadius: 22 }}>
      {[...Array(16)].map((_, i) => (
        <span key={i} style={{ position: "absolute", left: `${5 + (i * 6.1) % 92}%`, top: "40%", fontSize: 15 + (i % 3) * 6,
          animation: `burst ${0.9 + (i % 4) * 0.25}s ${(i % 5) * 0.05}s ease-out forwards` }}>🪙</span>
      ))}
    </div>
  );
}

const btnReset = { border: "none", background: "none", color: "inherit", font: "inherit", padding: 0, margin: 0 };

function Style() {
  return (
    <style>{`
      * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
      ::-webkit-scrollbar { height: 5px; width: 5px; }
      ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 9px; }
      @keyframes fall { 0%{transform:translateY(-10vh) rotate(0)} 100%{transform:translateY(112vh) rotate(360deg)} }
      @keyframes shimmer { 0%{transform:translateX(-120%)} 100%{transform:translateX(120%)} }
      @keyframes reelBlur { 0%{transform:translateY(-2px)} 100%{transform:translateY(2px)} }
      @keyframes flip { 0%{transform:rotateX(0)} 50%{transform:rotateX(90deg)} 100%{transform:rotateX(0)} }
      @keyframes pop { 0%{transform:scale(0.5);opacity:0} 60%{transform:scale(1.12)} 100%{transform:scale(1);opacity:1} }
      @keyframes popIn { 0%{transform:scale(0.88) translateY(14px);opacity:0} 100%{transform:scale(1) translateY(0);opacity:1} }
      @keyframes fade { from{opacity:0} to{opacity:1} }
      @keyframes shake { 0%,100%{transform:rotate(-4deg)} 50%{transform:rotate(4deg)} }
      @keyframes burst { 0%{transform:translateY(0) scale(0.4);opacity:0} 20%{opacity:1} 100%{transform:translateY(-160px) translateX(var(--x,0)) scale(1.1);opacity:0} }
      @media (prefers-reduced-motion: reduce) { *{animation-duration:0.01ms !important; animation-iteration-count:1 !important;} }
      input:focus { border-color: ${C.gold} !important; }
    `}</style>
  );
}
