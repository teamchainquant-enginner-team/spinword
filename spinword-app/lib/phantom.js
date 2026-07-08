"use client";
import { useState, useEffect, useCallback } from "react";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

/*
  Real Phantom (Solana) connection for identity + balance display.
  This is NOT a wagering/custody layer — it never takes funds or settles
  game outcomes on-chain. Entries/payouts run on the off-chain $SPIN points
  ledger until REAL_MONEY_ENABLED is cleared through compliance (see COMPLIANCE.md).
*/

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.mainnet-beta.solana.com";
const SPIN_MINT = process.env.NEXT_PUBLIC_SPIN_MINT || ""; // set to your SPL mint to show real $SPIN balance

export function getProvider() {
  if (typeof window === "undefined") return null;
  const p = window.solana;
  return p && p.isPhantom ? p : null;
}

export function usePhantom() {
  const [address, setAddress] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [solBalance, setSolBalance] = useState(null);
  const [spinBalance, setSpinBalance] = useState(null);

  // eager reconnect if the user already trusted the app
  useEffect(() => {
    const p = getProvider();
    if (!p) return;
    p.connect({ onlyIfTrusted: true })
      .then((r) => setAddress(r.publicKey.toString()))
      .catch(() => {});
    const onAcct = (pk) => setAddress(pk ? pk.toString() : null);
    p.on?.("accountChanged", onAcct);
    return () => p.off?.("accountChanged", onAcct);
  }, []);

  const connect = useCallback(async () => {
    const p = getProvider();
    if (!p) {
      setError("Phantom not found — install it at phantom.app");
      window.open("https://phantom.app/", "_blank");
      return;
    }
    setConnecting(true); setError(null);
    try {
      const r = await p.connect();
      setAddress(r.publicKey.toString());
    } catch (e) {
      setError("Connection cancelled");
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    const p = getProvider();
    try { await p?.disconnect(); } catch {}
    setAddress(null); setSolBalance(null); setSpinBalance(null);
  }, []);

  // sign a nonce so a backend can verify wallet ownership (sign-in-with-wallet)
  const signIn = useCallback(async (nonce) => {
    const p = getProvider();
    if (!p) return null;
    const msg = new TextEncoder().encode(`Sign in to SPINWORD\nnonce: ${nonce}`);
    const { signature } = await p.signMessage(msg, "utf8");
    return { address, signature };
  }, [address]);

  // read balances (read-only; safe)
  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    (async () => {
      try {
        const conn = new Connection(RPC, "confirmed");
        const owner = new PublicKey(address);
        const lamports = await conn.getBalance(owner);
        if (!cancelled) setSolBalance((lamports / LAMPORTS_PER_SOL).toFixed(3));
        if (SPIN_MINT) {
          const accts = await conn.getParsedTokenAccountsByOwner(owner, { mint: new PublicKey(SPIN_MINT) });
          const amt = accts.value[0]?.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
          if (!cancelled) setSpinBalance(Number(amt).toLocaleString());
        } else if (!cancelled) {
          setSpinBalance("set mint");
        }
      } catch (e) {
        if (!cancelled) { setSolBalance("rpc err"); setSpinBalance("rpc err"); }
      }
    })();
    return () => { cancelled = true; };
  }, [address]);

  return { address, connecting, error, solBalance, spinBalance, connect, disconnect, signIn };
}
