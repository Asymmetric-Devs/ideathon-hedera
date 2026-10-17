import { ethers } from "hardhat";
import { TopicCreateTransaction } from "@hashgraph/sdk";
import {
  GAS, contractLink, demoWallets, env, hectares, hederaClient, loadParcels, oracleWallet, topicLink, txLink, writeDeployment,
} from "./lib";

const FEE_BPS = 500; // comisión de plataforma: 5 % (tope 10 %)
const FUND_HBAR = "20";

async function main() {
  const oracle = oracleWallet();
  const { admin, owner, buyer } = demoWallets();
  console.log("Oráculo (cuenta de Hedera):", env("HEDERA_ACCOUNT_ID"), oracle.address);

  // 1. Topic de HCS: solo el oráculo puede escribir (submitKey), cualquiera puede leer.
  const client = hederaClient();
  const topicTx = await new TopicCreateTransaction()
    .setTopicMemo("Dosel · evidencia de verificaciones satelitales")
    .setSubmitKey(client.operatorPublicKey!)
    .execute(client);
  const topicId = (await topicTx.getReceipt(client)).topicId!.toString();
  console.log("Topic HCS:", topicId, topicLink(topicId));

  // 2. Fondos para las cuentas de la demo (se crean solas al recibir HBAR).
  for (const w of [admin, owner, buyer]) {
    const tx = await oracle.sendTransaction({ to: w.address, value: ethers.parseEther(FUND_HBAR), gasLimit: 100_000 });
    await tx.wait();
    console.log(`Fondeada ${w.address} con ${FUND_HBAR} HBAR`);
  }

  // 3. Contratos en HSCS.
  const GreenTon = await ethers.getContractFactory("GreenTon", admin);
  const greenton = await GreenTon.deploy(admin.address, oracle.address, { gasLimit: GAS.deploy });
  const gtDeploy = greenton.deploymentTransaction()!;
  await greenton.waitForDeployment();
  const greentonAddr = await greenton.getAddress();
  console.log("GreenTon:", greentonAddr, txLink(gtDeploy.hash));

  const Market = await ethers.getContractFactory("Market", admin);
  const market = await Market.deploy(greentonAddr, admin.address, FEE_BPS, { gasLimit: GAS.deploy });
  const mkDeploy = market.deploymentTransaction()!;
  await market.waitForDeployment();
  const marketAddr = await market.getAddress();
  console.log("Market:  ", marketAddr, txLink(mkDeploy.hash));

  // 4. Alta de los predios (la firma el admin, a nombre del propietario).
  const txs: Record<string, string> = { greentonDeploy: gtDeploy.hash, marketDeploy: mkDeploy.hash, topicCreate: topicTx.transactionId.toString() };
  for (const p of loadParcels()) {
    const tx = await greenton.registerParcel(owner.address, p.id, hectares(p.bbox), p.bbox.join(","), { gasLimit: GAS.call });
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
