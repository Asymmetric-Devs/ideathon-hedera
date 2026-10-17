import fs from "fs";
import path from "path";
import { ethers } from "hardhat";
import type { Wallet } from "ethers";
import { Client, PrivateKey, AccountId } from "@hashgraph/sdk";

export const ROOT = path.join(__dirname, "..");
export const DEPLOYMENT_FILE = path.join(ROOT, "deployments", "hedera-testnet.json");
export const WALLETS_FILE = path.join(ROOT, ".wallets.json"); // claves de la demo, nunca se versiona
export const HASHSCAN = "https://hashscan.io/testnet";
export const MIRROR = "https://testnet.mirrornode.hedera.com";

export type Deployment = {
  network: "hedera-testnet";
  chainId: 296;
  topicId: string;
  greenton: string;
  market: string;
  feeBps: number;
  accounts: { admin: string; oracle: string; owner: string; buyer: string };
  hederaAccountId: string;
  txs: Record<string, string>;
};

export function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta ${name} en el .env (ver .env.example)`);
  return v;
}

/** Clave ECDSA de la cuenta de Hedera Testnet que hace de oráculo y paga el topic de HCS. */
export function operatorKey(): string {
  const k = env("HEDERA_PRIVATE_KEY");
  return k.startsWith("0x") ? k : `0x${k}`;
}

export function hederaClient(): Client {
  const client = Client.forTestnet();
  client.setOperator(AccountId.fromString(env("HEDERA_ACCOUNT_ID")), PrivateKey.fromStringECDSA(operatorKey()));
  // Si el puerto gRPC está bloqueado (redes con firewall), fallar rápido en vez de reintentar minutos.
  client.setMaxAttempts(3).setRequestTimeout(10_000);
  return client;
}

export function provider() {
  return ethers.provider;
}

export function oracleWallet() {
  return new ethers.Wallet(operatorKey(), provider());
}

/** Wallets de la demo (admin, propietario, comprador). Se generan una vez y quedan en `.wallets.json`. */
export function demoWallets(): { admin: Wallet; owner: Wallet; buyer: Wallet } {
  let keys: Record<string, string> = fs.existsSync(WALLETS_FILE) ? JSON.parse(fs.readFileSync(WALLETS_FILE, "utf8")) : {};
  for (const r of ["admin", "owner", "buyer"]) keys[r] ??= ethers.Wallet.createRandom().privateKey;
  fs.writeFileSync(WALLETS_FILE, JSON.stringify(keys, null, 2));
  const w = (r: string) => new ethers.Wallet(keys[r], provider());
  return { admin: w("admin"), owner: w("owner"), buyer: w("buyer") };
}

export function readDeployment(): Deployment {
  if (!fs.existsSync(DEPLOYMENT_FILE)) throw new Error("Falta deployments/hedera-testnet.json: corré primero `npm run deploy`");
  return JSON.parse(fs.readFileSync(DEPLOYMENT_FILE, "utf8"));
}

export function writeDeployment(d: Deployment) {
  fs.mkdirSync(path.dirname(DEPLOYMENT_FILE), { recursive: true });
  fs.writeFileSync(DEPLOYMENT_FILE, JSON.stringify(d, null, 2) + "\n");
}

export const txLink = (hash: string) => `${HASHSCAN}/transaction/${hash}`;
export const contractLink = (addr: string) => `${HASHSCAN}/contract/${addr}`;
export const topicLink = (id: string) => `${HASHSCAN}/topic/${id}`;

/** Gas fijo: el estimador del relay JSON-RPC subestima las llamadas que mueven HBAR o llaman a otro contrato. */
export const GAS = { deploy: 4_000_000, call: 1_500_000 };

export function loadParcels(): { id: string; name: string; bbox: number[] }[] {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "oracle", "parcels.json"), "utf8"));
}

export function hectares(bbox: number[]): number {
  const [lon0, lat0, lon1, lat1] = bbox;
  const mid = ((lat0 + lat1) / 2) * (Math.PI / 180);
  return Math.round((lon1 - lon0) * 111.32 * Math.cos(mid) * (lat1 - lat0) * 110.57 * 100);
}
