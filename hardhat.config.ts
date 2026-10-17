import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";

// Clave ECDSA (secp256k1) de la cuenta de Hedera Testnet (ver .env.example). Las otras cuentas de la demo las
// genera scripts/deploy.ts y las guarda en .wallets.json.
const key = process.env.HEDERA_PRIVATE_KEY;
const accounts = key ? [key.startsWith("0x") ? key : `0x${key}`] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "paris" },
  },
  networks: {
    hedera_testnet: {
      url: process.env.HEDERA_RPC_URL ?? "https://testnet.hashio.io/api",
      chainId: 296,
      accounts,
    },
  },
};

export default config;
