import { expect } from "chai";
import { ethers } from "hardhat";

const EVIDENCE = ethers.id("evidencia-hcs");

async function setup() {
  const [admin, oracle, owner, buyer, stranger] = await ethers.getSigners();
  const c = await (await ethers.getContractFactory("GreenTon")).deploy(admin.address, oracle.address);
  await c.registerParcel(owner.address, "IBERA1", 1000, "-57.5,-28.5,-57.4,-28.4");
  return { c, admin, oracle, owner, buyer, stranger };
}

describe("GreenTon", () => {
  it("registrar un predio lo hace el admin, no el propietario", async () => {
    const { c, owner, stranger } = await setup();
    expect((await c.getParcel("IBERA1")).owner).to.equal(owner.address);
    await expect(c.connect(stranger).registerParcel(stranger.address, "IBERA2", 1, "x")).to.be.revertedWithCustomError(c, "NotAdmin");
    await expect(c.connect(owner).registerParcel(owner.address, "IBERA2", 1, "x")).to.be.revertedWithCustomError(c, "NotAdmin");
    await expect(c.getParcel("IBERA2")).to.be.revertedWithCustomError(c, "ParcelNotFound");
  });

  it("rechaza un predio duplicado", async () => {
    const { c, owner } = await setup();
    await expect(c.registerParcel(owner.address, "IBERA1", 1, "x")).to.be.revertedWithCustomError(c, "ParcelExists");
  });

  it("solo el oráculo emite", async () => {
    const { c, admin, owner } = await setup();
    await expect(c.connect(admin).submitVerification("IBERA1", 202510, 720, 50, EVIDENCE)).to.be.revertedWithCustomError(c, "NotOracle");
    await expect(c.connect(owner).submitVerification("IBERA1", 202510, 720, 50, EVIDENCE)).to.be.revertedWithCustomError(c, "NotOracle");
  });

  it("emite y luego retira", async () => {
    const { c, oracle, owner } = await setup();
    await c.connect(oracle).submitVerification("IBERA1", 202510, 720, 50, EVIDENCE);
    expect(await c.balance(owner.address)).to.equal(50);
    expect(await c.totalSupply()).to.equal(50);

    await expect(c.connect(owner).retire("IBERA1", 202510, 20, "Empresa SA"))
      .to.emit(c, "Retired").withArgs(owner.address, 0, "IBERA1", 202510, 20, "Empresa SA");
    expect(await c.balance(owner.address)).to.equal(30);
    expect(await c.totalSupply()).to.equal(30);
    expect(await c.totalRetired()).to.equal(20);
    expect(await c.retirementCount()).to.equal(1);
    const r = await c.getRetirement(0);
    expect(r.amount).to.equal(20);
    expect(r.parcel).to.equal("IBERA1");
    expect(r.period).to.equal(202510);
    expect(r.holder).to.equal(owner.address);
  });

  it("cada período es su propio lote y guarda la evidencia", async () => {
    const { c, oracle, owner } = await setup();
    await c.connect(oracle).submitVerification("IBERA1", 202509, 700, 10, EVIDENCE);
    await c.connect(oracle).submitVerification("IBERA1", 202510, 710, 7, ethers.id("otra"));
    const lots = await c.lotsOf(owner.address);
    expect(lots.length).to.equal(2);
    expect(await c.lotBalance(owner.address, "IBERA1", 202509)).to.equal(10);
    expect(await c.lotBalance(owner.address, "IBERA1", 202510)).to.equal(7);
    expect(await c.balance(owner.address)).to.equal(17);
    const info = await c.getLot("IBERA1", 202510);
    expect(info.minted).to.equal(7);
    expect(info.ndviMilli).to.equal(710);
    expect(info.evidence).to.equal(ethers.id("otra"));
  });

  it("no se puede gastar un lote con el saldo de otro", async () => {
    const { c, oracle, owner } = await setup();
    await c.connect(oracle).submitVerification("IBERA1", 202509, 700, 12, EVIDENCE);
    await expect(c.connect(owner).retire("IBERA1", 202510, 5, "x")).to.be.revertedWithCustomError(c, "InsufficientBalance");
    expect(await c.balance(owner.address)).to.equal(12);
  });

  it("transferir mueve solo el lote indicado", async () => {
    const { c, oracle, owner, buyer } = await setup();
    await c.connect(oracle).submitVerification("IBERA1", 202509, 700, 10, EVIDENCE);
    await c.connect(oracle).submitVerification("IBERA1", 202510, 710, 5, EVIDENCE);
    await c.connect(owner).transfer(buyer.address, "IBERA1", 202510, 3);
    expect(await c.lotBalance(buyer.address, "IBERA1", 202510)).to.equal(3);
    expect(await c.lotBalance(buyer.address, "IBERA1", 202509)).to.equal(0);
    expect(await c.lotBalance(owner.address, "IBERA1", 202510)).to.equal(2);
    expect(await c.lotBalance(owner.address, "IBERA1", 202509)).to.equal(10);
    expect((await c.lotsOf(buyer.address)).length).to.equal(1);
  });

  it("un lote vaciado sale del índice de la cuenta", async () => {
    const { c, oracle, owner } = await setup();
    await c.connect(oracle).submitVerification("IBERA1", 202509, 700, 4, EVIDENCE);
    await c.connect(oracle).submitVerification("IBERA1", 202510, 700, 6, EVIDENCE);
    await c.connect(owner).retire("IBERA1", 202509, 4, "x");
    const lots = await c.lotsOf(owner.address);
    expect(lots.length).to.equal(1);
    expect(lots[0].period).to.equal(202510);
    await c.connect(owner).retire("IBERA1", 202510, 6, "x");
    expect((await c.lotsOf(owner.address)).length).to.equal(0);
    expect(await c.balance(owner.address)).to.equal(0);
  });

  it("el mismo período no se emite dos veces", async () => {
    const { c, oracle } = await setup();
    await c.connect(oracle).submitVerification("IBERA1", 202510, 700, 10, EVIDENCE);
    await expect(c.connect(oracle).submitVerification("IBERA1", 202510, 700, 10, EVIDENCE)).to.be.revertedWithCustomError(c, "PeriodAlreadyIssued");
    expect(await c.totalSupply()).to.equal(10);
  });

  it("una caída de NDVI congela el predio y frena la emisión", async () => {
    const { c, oracle } = await setup();
    await c.connect(oracle).submitVerification("IBERA1", 202509, 720, 10, EVIDENCE); // línea base 720
    await expect(c.connect(oracle).submitVerification("IBERA1", 202510, 420, 10, EVIDENCE))
      .to.emit(c, "Frozen");
    expect((await c.getParcel("IBERA1")).frozen).to.equal(true);
    expect(await c.totalSupply()).to.equal(10);
    expect((await c.getLot("IBERA1", 202510)).exists).to.equal(false);
    expect(await c.isPeriodIssued("IBERA1", 202510)).to.equal(true);
    await expect(c.connect(oracle).submitVerification("IBERA1", 202511, 720, 10, EVIDENCE)).to.be.revertedWithCustomError(c, "ParcelFrozen");
  });

  it("un NDVI absoluto bajo congela", async () => {
    const { c, oracle } = await setup();
    await c.connect(oracle).submitVerification("IBERA1", 202510, 300, 10, EVIDENCE);
    expect((await c.getParcel("IBERA1")).frozen).to.equal(true);
    expect(await c.totalSupply()).to.equal(0);
  });

  it("solo el admin levanta el congelamiento y la línea base pasa al último NDVI", async () => {
    const { c, admin, oracle } = await setup();
    await c.connect(oracle).submitVerification("IBERA1", 202509, 720, 10, EVIDENCE);
    await expect(c.unfreeze("IBERA1")).to.be.revertedWithCustomError(c, "NotFrozen");
    await c.connect(oracle).submitVerification("IBERA1", 202510, 420, 10, EVIDENCE);
    await expect(c.connect(oracle).unfreeze("IBERA1")).to.be.revertedWithCustomError(c, "NotAdmin");
    await c.connect(admin).unfreeze("IBERA1");
    const p = await c.getParcel("IBERA1");
    expect(p.frozen).to.equal(false);
    expect(p.baselineNdviMilli).to.equal(420);
    await c.connect(oracle).submitVerification("IBERA1", 202511, 430, 3, EVIDENCE);
    expect(await c.totalSupply()).to.equal(13);
  });

  it("congelar no bloquea retirar lotes ya emitidos", async () => {
    const { c, oracle, owner } = await setup();
    await c.connect(oracle).submitVerification("IBERA1", 202509, 720, 10, EVIDENCE);
    await c.connect(oracle).submitVerification("IBERA1", 202510, 420, 10, EVIDENCE);
    await c.connect(owner).retire("IBERA1", 202509, 10, "x");
    expect(await c.totalRetired()).to.equal(10);
  });

  it("no se puede retirar más que el saldo ni cantidad cero", async () => {
    const { c, oracle, owner } = await setup();
    await c.connect(oracle).submitVerification("IBERA1", 202510, 700, 5, EVIDENCE);
    await expect(c.connect(owner).retire("IBERA1", 202510, 6, "x")).to.be.revertedWithCustomError(c, "InsufficientBalance");
    await expect(c.connect(owner).retire("IBERA1", 202510, 0, "x")).to.be.revertedWithCustomError(c, "InvalidAmount");
  });

  it("un predio desconocido se rechaza", async () => {
    const { c, oracle } = await setup();
    await expect(c.connect(oracle).submitVerification("NOPE", 1, 700, 5, EVIDENCE)).to.be.revertedWithCustomError(c, "ParcelNotFound");
  });

  it("transferFrom exige ser el titular o un operador autorizado", async () => {
    const { c, oracle, owner, buyer, stranger } = await setup();
    await c.connect(oracle).submitVerification("IBERA1", 202510, 700, 10, EVIDENCE);
    await expect(c.connect(stranger).transferFrom(owner.address, stranger.address, "IBERA1", 202510, 5)).to.be.revertedWithCustomError(c, "NotAuthorized");
    await c.connect(owner).setOperator(stranger.address, true);
    await c.connect(stranger).transferFrom(owner.address, buyer.address, "IBERA1", 202510, 5);
    expect(await c.lotBalance(buyer.address, "IBERA1", 202510)).to.equal(5);
    await c.connect(owner).setOperator(stranger.address, false);
    await expect(c.connect(stranger).transferFrom(owner.address, buyer.address, "IBERA1", 202510, 1)).to.be.revertedWithCustomError(c, "NotAuthorized");
  });
});
