// Auditoría pública: para cada lote, baja de HCS (mirror node) el mensaje de evidencia, calcula su SHA-256 y
// lo compara con el hash que el contrato guardó al emitir. No hace falta confiar en el oráculo ni en esta web.
import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { ethers } from "hardhat";
import { MIRROR, ROOT, readDeployment } from "./lib";

async function main() {
  const d = readDeployment();
  const greenton = await ethers.getContractAt("GreenTon", d.greenton);
  const rows: { parcel: string; period: number; hcs_seq: string }[] = JSON.parse(
    fs.readFileSync(path.join(ROOT, "web", "public", "verifications.json"), "utf8"),
  );
  let bad = 0;
  for (const r of rows) {
    if (!r.hcs_seq) { console.log(`· ${r.parcel} ${r.period}: evidencia todavía no publicada en HCS (corré npm run hcs)`); continue; }
    const res = await fetch(`${MIRROR}/api/v1/topics/${d.topicId}/messages/${r.hcs_seq}`);
    if (!res.ok) { console.log(`✗ ${r.parcel} ${r.period}: no se pudo leer HCS #${r.hcs_seq} (${res.status})`); bad++; continue; }
    const msg = Buffer.from((await res.json() as { message: string }).message, "base64");
    const hash = "0x" + createHash("sha256").update(msg).digest("hex");
    const lot = await greenton.getLot(r.parcel, r.period);
    const stored = lot.exists ? lot.evidence : null;
    // Los predios congelados no crean lote: su evidencia queda en HCS y en el evento Frozen.
    if (stored === null) { console.log(`· ${r.parcel} ${r.period}: sin lote (congelado). Evidencia en HCS #${r.hcs_seq}: ${hash}`); continue; }
    const ok = stored === hash;
    if (!ok) bad++;
    console.log(`${ok ? "✓" : "✗"} ${r.parcel} ${r.period}: HCS #${r.hcs_seq} ${ok ? "coincide con" : "NO coincide con"} el hash del lote`);
  }
  if (bad) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
