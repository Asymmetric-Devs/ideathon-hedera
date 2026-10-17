// Publica en HCS la evidencia de las verificaciones que ya están en el contrato y todavía no tienen mensaje.
// Crea el topic si falta. El mensaje se reconstruye igual que al verificar, y se comprueba que su SHA-256
// coincida con el hash que el contrato guardó en el lote antes de publicarlo.
import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { TopicCreateTransaction, TopicMessageSubmitTransaction } from "@hashgraph/sdk";
import { ROOT, hederaClient, readDeployment, topicLink, writeDeployment } from "./lib";
import { evidenceMessage, type Evidence } from "./submit-verification";

async function main() {
  const d = readDeployment();
  const client = hederaClient();
  if (!d.topicId) {
    const tx = await new TopicCreateTransaction()
      .setTopicMemo("Dosel · evidencia de verificaciones satelitales")
      .setSubmitKey(client.operatorPublicKey!)
      .execute(client);
    d.topicId = (await tx.getReceipt(client)).topicId!.toString();
    d.txs.topicCreate = tx.transactionId.toString();
    console.log("Topic HCS:", d.topicId, topicLink(d.topicId));
    writeDeployment(d);
  }
  const log = path.join(ROOT, "web", "public", "verifications.json");
  const rows = JSON.parse(fs.readFileSync(log, "utf8"));
  for (const r of rows) {
    if (r.hcs_seq) continue;
    const ev: Evidence = JSON.parse(fs.readFileSync(path.join(ROOT, "oracle", "evidence", `${r.parcel}-${r.period}.json`), "utf8"));
    const msg = evidenceMessage(ev, d.greenton, d.accounts.oracle);
    const hash = "0x" + createHash("sha256").update(msg).digest("hex");
    if (hash !== r.evidence) throw new Error(`${r.parcel} ${r.period}: el mensaje reconstruido no coincide con el hash del contrato`);
    const sent = await new TopicMessageSubmitTransaction().setTopicId(d.topicId).setMessage(msg).execute(client);
    r.hcs_seq = (await sent.getReceipt(client)).topicSequenceNumber!.toString();
    r.hcs_topic = d.topicId;
    d.txs[`hcs:${r.parcel}-${r.period}`] = `${d.topicId}#${r.hcs_seq}`;
    console.log(`${r.parcel} ${r.period} → HCS #${r.hcs_seq}`);
    fs.writeFileSync(log, JSON.stringify(rows, null, 2));
    writeDeployment(d);
  }
  client.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
