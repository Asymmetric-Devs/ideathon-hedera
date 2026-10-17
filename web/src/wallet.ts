import { getAddress } from "ethers";
import { CHAIN_ID, EXPLORER, RPC_URL } from "./config";

export type WalletIssue = "missing" | "denied" | "network" | "other";

export class WalletError extends Error {
  constructor(public issue: WalletIssue, message: string, public detail?: string) {
    super(message);
  }
}

type Eip1193 = { request(a: { method: string; params?: unknown[] }): Promise<unknown> };
export const injected = () => (window as unknown as { ethereum?: Eip1193 }).ethereum;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const HEX_CHAIN = `0x${CHAIN_ID.toString(16)}`;

/** La extensión se inyecta unos instantes después de cargar la página: se espera antes de darla por ausente. */
async function detected(): Promise<Eip1193 | null> {
  for (let i = 0; i < 6; i++) {
    const p = injected();
    if (p) return p;
    await sleep(200);
  }
  return null;
}

const isDenied = (e: unknown) => {
  const x = e as { code?: number; message?: string };
  return x.code === 4001 || /declin|reject|denied|cancel|closed/i.test(String(x.message ?? e));
};

/** Pone la billetera en Hedera Testnet; si no la conoce, se la agrega. */
async function ensureNetwork(p: Eip1193) {
  try {
    await p.request({ method: "wallet_switchEthereumChain", params: [{ chainId: HEX_CHAIN }] });
  } catch (e) {
    if (isDenied(e)) throw new WalletError("network", "No aceptaste cambiar a Hedera Testnet.", "otra red");
    try {
      await p.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: HEX_CHAIN,
          chainName: "Hedera Testnet",
          nativeCurrency: { name: "HBAR", symbol: "HBAR", decimals: 18 },
          rpcUrls: [RPC_URL],
          blockExplorerUrls: [EXPLORER],
        }],
      });
    } catch (e2) {
      throw new WalletError("network", "No se pudo agregar Hedera Testnet a tu billetera.", String((e2 as Error).message ?? e2));
    }
  }
}

/** Conecta una billetera EVM (MetaMask, Brave, Rabby…) en Hedera Testnet. Devuelve la dirección en formato EIP-55. */
export async function connectWallet(): Promise<string> {
  const p = await detected();
  if (!p) throw new WalletError("missing", "No se detectó una billetera EVM en este navegador.");
  let accounts: string[];
  try {
    accounts = (await p.request({ method: "eth_requestAccounts" })) as string[];
  } catch (e) {
    throw new WalletError(isDenied(e) ? "denied" : "other", String((e as Error).message ?? e));
  }
  await ensureNetwork(p);
  if (!accounts[0]) throw new WalletError("other", "La billetera no devolvió ninguna cuenta.");
  return getAddress(accounts[0]);
}

export const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
