const env = import.meta.env;

// Direcciones EVM de GreenTon y del mercado en Hedera Testnet (salen de `npm run deploy`, ver README).
// Se pueden pisar con VITE_GREENTON_ID / VITE_MARKET_ID / VITE_TOPIC_ID.
export const CONTRACT_ID: string = env.VITE_GREENTON_ID ?? "";
export const MARKET_ID: string = env.VITE_MARKET_ID ?? "";
/** Topic de HCS donde el oráculo publica la evidencia de cada verificación satelital. */
export const TOPIC_ID: string = env.VITE_TOPIC_ID ?? "";
export const CONFIGURED = CONTRACT_ID !== "" && MARKET_ID !== "";

/** Se paga en HBAR. Los importes del contrato están en tinybars (8 decimales). */
export const PAYMENT_ASSET_CODE = "HBAR";
export const PAYMENT_DECIMALS = 8;
/** El relay JSON-RPC recibe weibars; dentro del contrato `msg.value` está en tinybars. */
export const WEIBAR_PER_TINYBAR = 10_000_000_000n;

export const CHAIN_ID = 296;
export const RPC_URL = env.VITE_RPC_URL ?? "https://testnet.hashio.io/api";
export const MIRROR = "https://testnet.mirrornode.hedera.com";
export const EXPLORER = "https://hashscan.io/testnet";
export const FAUCET = "https://portal.hedera.com/faucet";
export const PARCEL_IDS = ["IMPEN1", "CHACO1", "TACOP1"];

/** Cuentas públicas de la demo en Testnet (las completa `npm run deploy` en deployments/hedera-testnet.json). */
export const ACCOUNTS: { role: string; address: string }[] = [
  { role: "Administrador (auditor)", address: env.VITE_ADMIN_ADDRESS ?? "" },
  { role: "Oráculo", address: env.VITE_ORACLE_ADDRESS ?? "" },
  { role: "Propietario de los predios", address: env.VITE_OWNER_ADDRESS ?? "" },
].filter((a) => a.address !== "");

/** Repositorio donde llegan las propuestas de predios (cada una abre un issue prellenado). */
export const REPO_URL = "https://github.com/Asymmetric-Devs/ideathon-hedera";
