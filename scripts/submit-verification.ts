import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { ethers } from "hardhat";
import { TopicMessageSubmitTransaction } from "@hashgraph/sdk";
import { GAS, ROOT, hederaClient, oracleWallet, readDeployment, topicLink, txLink } from "./lib";

export type Evidence = {
  parcel: string; period: number; ndvi: number; scene: string; scene_date: string; cloud: number;
  hectares: number; tco2e_proposed: number; bbox: number[]; range: string;
};

/** Mensaje canónico que se publica en HCS. Su SHA-256 queda guardado en el lote, así cualquiera lo verifica. */
export function evidenceMessage(ev: Evidence, contract: string, oracle: string): string {
  return JSON.stringify({
    v: 1, type: "dosel.verification", parcel: ev.parcel, period: ev.period, ndvi: ev.ndvi,
    satellite: "Sentinel-2 L2A", scene: ev.scene, scene_date: ev.scene_date, cloud: ev.cloud,
    bbox: ev.bbox, hectares: ev.hectares, tco2e: ev.tco2e_proposed, contract, oracle,
  });
}

/** Publica la evidencia en HCS y firma la verificación en el contrato. Devuelve los datos para mostrar. */
export async function submitVerification(ev: Evidence) {
  const d = readDeployment();
  const oracle = oracleWallet();
  const client = hederaClient();
  const msg = evidenceMessage(ev, d.greenton, oracle.address);
  const evidence = "0x" + createHash("sha256").update(msg).digest("hex");

  const sent = await new TopicMessageSubmitTransaction().setTopicId(d.topicId).setMessage(msg).execute(client);
  const receipt = await sent.getReceipt(client);
  const seq = receipt.topicSequenceNumber!.toString();
  console.log(`HCS #${seq} en ${d.topicId}:`, `${topicLink(d.topicId)}`);

  const greenton = await ethers.getContractAt("GreenTon", d.greenton, oracle);
  const ndviMilli = Math.round(ev.ndvi * 1000);
  const tx = await greenton.submitVerification(ev.parcel, ev.period, ndviMilli, ev.tco2e_proposed, evidence, { gasLimit: GAS.call });
  await tx.wait();
  const lot = await greenton.getLot(ev.parcel, ev.period);
  const minted = lot.exists ? lot.minted.toString() : "0";
  console.log(`${ev.parcel} ${ev.period} NDVI ${ev.ndvi} → emitido ${minted} GTON${lot.exists ? "" : " (predio CONGELADO)"}`, txLink(tx.hash));

  // Registro público de evidencia para la web (la web también lee HCS directamente del mirror node).
  const log = path.join(ROOT, "web", "public", "verifications.json");
  const rows = fs.existsSync(log) ? JSON.parse(fs.readFileSync(log, "utf8")) : [];
  rows.push({
    parcel: ev.parcel, period: ev.period, ndvi: ev.ndvi, scene: ev.scene, scene_date: ev.scene_date, cloud: ev.cloud,
    hectares: ev.hectares, tco2e_proposed: ev.tco2e_proposed, minted, tx: tx.hash, hcs_topic: d.topicId, hcs_seq: seq, evidence,
  });
  fs.writeFileSync(log, JSON.stringify(rows, null, 2));
  client.close();
  return { tx: tx.hash, seq, minted, evidence };
}

if (require.main === module) {
  const file = process.env.EVIDENCE_FILE;
  if (!file) throw new Error("Indicá la evidencia con EVIDENCE_FILE=oracle/evidence/<PREDIO>-<PERIODO>.json");
  submitVerification(JSON.parse(fs.readFileSync(file, "utf8"))).catch((e) => { console.error(e); process.exit(1); });
}
