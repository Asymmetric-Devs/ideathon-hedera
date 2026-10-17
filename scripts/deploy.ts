import { ethers } from "hardhat";
import { TopicCreateTransaction } from "@hashgraph/sdk";
import {
  contractLink, demoWallets, env, hectares, hederaClient, loadParcels, oracleWallet, topicLink, txLink, writeDeployment,
} from "./lib";

const FEE_BPS = 500; // comisión de plataforma: 5 % (tope 10 %)
// El faucet da pocos HBAR: admin paga los despliegues, el comprador el pago de la demo.
const FUND_HBAR: Record<string, string> = { admin: "4", owner: "1", buyer: "2" };

async function main() {
  const oracle = oracleWallet();
  const { admin, owner, buyer } = demoWallets();
  console.log("Oráculo (cuenta de Hedera):", env("HEDERA_ACCOUNT_ID"), oracle.address);

  // 1. Topic de HCS: solo el oráculo puede escribir (submitKey), cualquiera puede leer.
  // HCS usa gRPC (puerto 50211). Si la red lo bloquea, el despliegue sigue sin topic y `npm run hcs` lo crea después.
  const client = hederaClient();
  let topicId = "";
  let topicTxId = "";
  try {
    const topicTx = await new TopicCreateTransaction()
      .setTopicMemo("Dosel · evidencia de verificaciones satelitales")
      .setSubmitKey(client.operatorPublicKey!)
      .execute(client);
    topicId = (await topicTx.getReceipt(client)).topicId!.toString();
    topicTxId = topicTx.transactionId.toString();
    console.log("Topic HCS:", topicId, topicLink(topicId));
  } catch (e) {
    console.warn("⚠ No se pudo crear el topic de HCS (¿puerto gRPC bloqueado?). Sigo sin él; corré `npm run hcs` desde otra red.\n ", (e as Error).message.split("\n")[0]);
  }

  // 2. Fondos: si la cuenta ya tiene HBAR (por ejemplo del faucet) no se toca. Si no, se le transfiere.
  for (const [role, w] of Object.entries({ admin, owner, buyer })) {
    if ((await w.provider!.getBalance(w.address)) > ethers.parseEther("1")) { console.log(`${role} ${w.address} ya tiene saldo`); continue; }
    const tx = await oracle.sendTransaction({ to: w.address, value: ethers.parseEther(FUND_HBAR[role]), gasLimit: 400_000 });
    await tx.wait();
    console.log(`Fondeada ${role} ${w.address} con ${FUND_HBAR[role]} HBAR`);
  }

  // 3. Contratos en HSCS.
  const GreenTon = await ethers.getContractFactory("GreenTon", admin);
  const greenton = await GreenTon.deploy(admin.address, oracle.address, {});
  const gtDeploy = greenton.deploymentTransaction()!;
  await greenton.waitForDeployment();
  const greentonAddr = await greenton.getAddress();
  console.log("GreenTon:", greentonAddr, txLink(gtDeploy.hash));

  const Market = await ethers.getContractFactory("Market", admin);
  const market = await Market.deploy(greentonAddr, admin.address, FEE_BPS, {});
  const mkDeploy = market.deploymentTransaction()!;
  await market.waitForDeployment();
  const marketAddr = await market.getAddress();
  console.log("Market:  ", marketAddr, txLink(mkDeploy.hash));

  // 4. Alta de los predios (la firma el admin, a nombre del propietario).
  const txs: Record<string, string> = { greentonDeploy: gtDeploy.hash, marketDeploy: mkDeploy.hash, ...(topicTxId ? { topicCreate: topicTxId } : {}) };
  for (const p of loadParcels()) {
    const tx = await greenton.registerParcel(owner.address, p.id, hectares(p.bbox), p.bbox.join(","), {});
    await tx.wait();
    txs[`register:${p.id}`] = tx.hash;
    console.log(`Predio ${p.id} registrado`, txLink(tx.hash));
  }

  writeDeployment({
    network: "hedera-testnet", chainId: 296, topicId, greenton: greentonAddr, market: marketAddr, feeBps: FEE_BPS,
    accounts: { admin: admin.address, oracle: oracle.address, owner: owner.address, buyer: buyer.address },
    hederaAccountId: env("HEDERA_ACCOUNT_ID"), txs,
  });
  console.log("\nListo. Guardado en deployments/hedera-testnet.json");
  console.log("GreenTon en HashScan:", contractLink(greentonAddr));
  client.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
