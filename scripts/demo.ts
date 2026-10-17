// Recorre el flujo completo de Dosel en Hedera Testnet y deja los IDs de transacción en deployments/hedera-testnet.json.
//   1) el oráculo publica la evidencia satelital en HCS y firma la verificación en HSCS (emite lotes o congela)
//   2) el propietario ofrece un lote en el mercado   3) una empresa compra y quema en una sola transacción
// Las mediciones salen de oracle/evidence/*.json (Sentinel-2 real). Para medir de nuevo: `python oracle/run.py verify ...`.
import fs from "fs";
import path from "path";
import { ethers } from "hardhat";
import { GAS, ROOT, contractLink, demoWallets, readDeployment, topicLink, txLink, writeDeployment } from "./lib";
import { submitVerification, type Evidence } from "./submit-verification";

/** El relay JSON-RPC recibe weibars; dentro del contrato `msg.value` está en tinybars (1 tinybar = 1e10 weibars). */
const WEIBAR_PER_TINYBAR = 10_000_000_000n;
const PRICE_TINYBARS_PER_TON = 1_000_000n; // 0,01 HBAR por tonelada
const LIST_TONS = 3000n;
const BUY_TONS = 500n;
const BENEFICIARY = "Empresa Demo SA - huella 2026";

async function main() {
  const d = readDeployment();
  const { owner, buyer } = demoWallets();

  const evDir = path.join(ROOT, "oracle", "evidence");
  const files = fs.readdirSync(evDir).filter((f) => f.endsWith(".json")).sort((a, b) => {
    const [pa, ya] = a.replace(".json", "").split("-"); const [pb, yb] = b.replace(".json", "").split("-");
    return Number(ya) - Number(yb) || pa.localeCompare(pb);
  });
  for (const f of files) {
    const r = await submitVerification(JSON.parse(fs.readFileSync(path.join(evDir, f), "utf8")) as Evidence);
    d.txs[`verify:${f.replace(".json", "")}`] = r.tx;
    d.txs[`hcs:${f.replace(".json", "")}`] = `${d.topicId}#${r.seq}`;
  }

  const greenton = await ethers.getContractAt("GreenTon", d.greenton, owner);
  const market = await ethers.getContractAt("Market", d.market, owner);

  const approve = await greenton.setOperator(d.market, true, { gasLimit: GAS.call });
  await approve.wait();
  const list = await market.list("IMPEN1", 202603, LIST_TONS, PRICE_TINYBARS_PER_TON, { gasLimit: GAS.call });
  await list.wait();
  d.txs["list:IMPEN1-202603"] = list.hash;
  console.log(`Oferta 0: ${LIST_TONS} t de IMPEN1 2026 a 0,01 HBAR/t`, txLink(list.hash));

  const paid = BUY_TONS * PRICE_TINYBARS_PER_TON;
  const buy = await (market.connect(buyer) as typeof market).buyAndRetire(0, BUY_TONS, BENEFICIARY, {
    value: paid * WEIBAR_PER_TINYBAR, gasLimit: GAS.call,
  });
  await buy.wait();
  d.txs["buyAndRetire:offer0"] = buy.hash;
  console.log(`Compra y quema atómica: ${BUY_TONS} t, pagó ${Number(paid) / 1e8} HBAR`, txLink(buy.hash));

  writeDeployment(d);
  console.log("\nEstado final:");
  console.log("  en circulación:", (await greenton.totalSupply()).toString(), "GTON · retiradas:", (await greenton.totalRetired()).toString());
  console.log("  GreenTon:", contractLink(d.greenton), "\n  Mercado: ", contractLink(d.market), "\n  Topic:   ", topicLink(d.topicId));
}

main().catch((e) => { console.error(e); process.exit(1); });
