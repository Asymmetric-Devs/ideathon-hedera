import { BrowserProvider, Contract, JsonRpcProvider, Network, id as keccak, getAddress, zeroPadValue, toBeHex, type ContractRunner } from "ethers";
import greentonAbi from "./abi/GreenTon.json";
import marketAbi from "./abi/Market.json";
import { CHAIN_ID, CONTRACT_ID, MARKET_ID, MIRROR, RPC_URL, WEIBAR_PER_TINYBAR } from "./config";
import { injected } from "./wallet";

const provider = new JsonRpcProvider(RPC_URL, Network.from(CHAIN_ID), { staticNetwork: true });
const greenton = (runner: ContractRunner = provider) => new Contract(CONTRACT_ID, greentonAbi, runner);
const market = (runner: ContractRunner = provider) => new Contract(MARKET_ID, marketAbi, runner);

export type Parcel = {
  owner: string; hectares: number; bbox: string; baseline_ndvi_milli: number;
  last_ndvi_milli: number; frozen: boolean; issued_tco2e: bigint;
};
export type Retirement = {
  holder: string; parcel: string; period: number; amount: bigint; beneficiary: string; ledger_time: bigint;
};
export type LotBalance = { parcel: string; period: number; amount: bigint };
/** `evidence` es el SHA-256 del mensaje que el oráculo publicó en HCS para esta verificación. */
export type LotInfo = { minted: bigint; ndvi_milli: number; ledger_time: bigint; evidence: string };
export type Offer = {
  seller: string; parcel: string; period: number; available: bigint; price_per_ton: bigint; open: boolean;
};
export type Purchase = { buyer: string; offer_id: number; amount: bigint; paid: bigint; fee?: bigint; retirement_id: number };

// ---- Lectura ----
async function call<T>(c: Contract, method: string, ...args: unknown[]): Promise<T> {
  return (await c.getFunction(method).staticCall(...args)) as T;
}

/** Hedera Testnet, como cualquier red, puede devolver errores transitorios: se reintenta una vez. */
async function read<T>(c: Contract, method: string, ...args: unknown[]): Promise<T> {
  try { return await call<T>(c, method, ...args); }
  catch (e) {
    if ((e as { code?: string }).code === "CALL_EXCEPTION") throw e;
    await new Promise((r) => setTimeout(r, 600));
    return call<T>(c, method, ...args);
  }
}

export const totalSupply = () => read<bigint>(greenton(), "totalSupply");
export const totalRetired = () => read<bigint>(greenton(), "totalRetired");
export const balanceOf = (a: string) => read<bigint>(greenton(), "balance", a);
export const retirementCount = () => read<bigint>(greenton(), "retirementCount").then(Number);

export async function lotsOf(a: string): Promise<LotBalance[]> {
  const rows = await read<{ parcel: string; period: bigint; amount: bigint }[]>(greenton(), "lotsOf", a);
  return rows.map((r) => ({ parcel: r.parcel, period: Number(r.period), amount: r.amount }));
}

export async function getLot(parcel: string, period: number): Promise<LotInfo | null> {
  const l = await read<{ minted: bigint; ndviMilli: bigint; timestamp: bigint; evidence: string; exists: boolean }>(greenton(), "getLot", parcel, period);
  return l.exists ? { minted: l.minted, ndvi_milli: Number(l.ndviMilli), ledger_time: l.timestamp, evidence: l.evidence } : null;
}

export async function getParcel(id: string): Promise<Parcel> {
  const p = await read<{ owner: string; hectares: bigint; bbox: string; baselineNdviMilli: bigint; lastNdviMilli: bigint; frozen: boolean; issuedTco2e: bigint }>(greenton(), "getParcel", id);
  return {
    owner: getAddress(p.owner), hectares: Number(p.hectares), bbox: p.bbox, baseline_ndvi_milli: Number(p.baselineNdviMilli),
    last_ndvi_milli: Number(p.lastNdviMilli), frozen: p.frozen, issued_tco2e: p.issuedTco2e,
  };
}

export async function getRetirement(id: number): Promise<Retirement | null> {
  try {
    const r = await read<{ holder: string; parcel: string; period: bigint; amount: bigint; beneficiary: string; timestamp: bigint }>(greenton(), "getRetirement", id);
    return { holder: getAddress(r.holder), parcel: r.parcel, period: Number(r.period), amount: r.amount, beneficiary: r.beneficiary, ledger_time: r.timestamp };
  } catch { return null; }
}

// ---- Mercado ----
export const offerCount = () => read<bigint>(market(), "offerCount").then(Number);
export const purchaseCount = () => read<bigint>(market(), "purchaseCount").then(Number);
export const feeBps = () => read<bigint>(market(), "feeBps").then(Number).catch(() => 0);
export type PurchaseRow = Purchase & { id: number };

export async function getOffer(id: number): Promise<Offer | null> {
  try {
    const o = await read<{ seller: string; parcel: string; period: bigint; available: bigint; pricePerTon: bigint; open: boolean }>(market(), "getOffer", id);
    return { seller: getAddress(o.seller), parcel: o.parcel, period: Number(o.period), available: o.available, price_per_ton: o.pricePerTon, open: o.open };
  } catch { return null; }
}

export async function getPurchase(id: number): Promise<Purchase | null> {
  try {
    const p = await read<{ buyer: string; offerId: bigint; amount: bigint; paid: bigint; fee: bigint; retirementId: bigint }>(market(), "getPurchase", id);
    return { buyer: getAddress(p.buyer), offer_id: Number(p.offerId), amount: p.amount, paid: p.paid, fee: p.fee, retirement_id: Number(p.retirementId) };
  } catch { return null; }
}

/**
 * Hash de la transacción que quemó un retiro. El mirror node de Hedera conserva el historial completo de logs,
 * así que se busca el evento `Retired` por su ID. Si no responde, usa retirements.json (hashes de retiros oficiales).
 */
export async function retirementTx(id: number, _r?: Retirement): Promise<string | null> {
  try {
    const topic0 = keccak("Retired(address,uint256,string,uint32,uint256,string)");
    const topic2 = zeroPadValue(toBeHex(id), 32);
    const url = `${MIRROR}/api/v1/contracts/${CONTRACT_ID}/results/logs?topic0=${topic0}&topic2=${topic2}&limit=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const hash = ((await res.json()) as { logs?: { transaction_hash: string }[] }).logs?.[0]?.transaction_hash;
    if (hash) return hash;
  } catch { /* sin mirror node */ }
  try {
    const m = await (await fetch("/retirements.json")).json();
    return m[`${CONTRACT_ID}:${id}`] ?? null;
  } catch { return null; }
}

/** Saldo de HBAR de una cuenta, en tinybars. */
export async function hbarBalance(addr: string): Promise<bigint> {
  return (await provider.getBalance(addr)) / WEIBAR_PER_TINYBAR;
}

/** Mensaje de evidencia que el oráculo publicó en HCS (mirror node). */
export async function hcsMessage(topicId: string, seq: number | string): Promise<{ text: string; sha256: string } | null> {
  try {
    const res = await fetch(`${MIRROR}/api/v1/topics/${topicId}/messages/${seq}`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const b64 = ((await res.json()) as { message: string }).message;
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    return { text: new TextDecoder().decode(bytes), sha256: "0x" + [...digest].map((x) => x.toString(16).padStart(2, "0")).join("") };
  } catch { return null; }
}

// ---- Escritura ----
const GAS = 1_500_000n;

async function signer(account: string) {
  const eth = injected();
  if (!eth) throw new Error("No se detectó una billetera EVM.");
  const s = await new BrowserProvider(eth as never, Network.from(CHAIN_ID)).getSigner(account);
  return s;
}

/** Simula primero (eth_call) para devolver el motivo exacto si el contrato lo rechaza, firma, envía y espera. Devuelve el hash. */
async function submit(account: string, build: (s: ContractRunner) => Contract, method: string, args: unknown[], value?: bigint): Promise<string> {
  const s = await signer(account);
  const fn = build(s).getFunction(method);
  const overrides = { gasLimit: GAS, ...(value !== undefined ? { value } : {}) };
  try {
    await fn.staticCall(...args, overrides);
  } catch (e) {
    const name = (e as { revert?: { name?: string } }).revert?.name;
    if (name) throw new Error(`contract:${name}`);
    if (!/CALL_EXCEPTION|execution reverted/i.test(String((e as Error).message))) throw e;
  }
  const tx = await fn(...args, overrides);
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error("La transacción falló en la red");
  return tx.hash as string;
}

/** Retira (quema) toneladas de un lote propio. */
export const retire = (holder: string, parcel: string, period: number, amount: bigint, beneficiary: string) =>
  submit(holder, greenton, "retire", [parcel, period, amount, beneficiary]);

/** Publica una oferta: el lote pasa a custodia del mercado. La primera vez, autoriza al mercado como operador (dos firmas). */
export async function list(seller: string, parcel: string, period: number, amount: bigint, pricePerTon: bigint) {
  const approved = await read<boolean>(greenton(), "isOperator", seller, MARKET_ID);
  if (!approved) await submit(seller, greenton, "setOperator", [MARKET_ID, true]);
  return submit(seller, market, "list", [parcel, period, amount, pricePerTon]);
}

/** Paga al vendedor y quema las toneladas a nombre del beneficiario, en una sola transacción. */
export async function buyAndRetire(buyer: string, offerId: number, amount: bigint, beneficiary: string) {
  const offer = await getOffer(offerId);
  if (!offer) throw new Error("contract:OfferNotFound");
  return submit(buyer, market, "buyAndRetire", [offerId, amount, beneficiary], amount * offer.price_per_ton * WEIBAR_PER_TINYBAR);
}

export const cancel = (_seller: string, offerId: number) => submit(_seller, market, "cancel", [offerId]);
