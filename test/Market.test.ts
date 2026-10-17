import { expect } from "chai";
import { ethers } from "hardhat";

const EVIDENCE = ethers.id("evidencia-hcs");
const PRICE = 10_000_000n; // tinybars por tonelada (0,1 HBAR)
const FEE_BPS = 500;

async function setup(feeBps = FEE_BPS) {
  const [admin, oracle, owner, buyer, treasury, stranger] = await ethers.getSigners();
  const g = await (await ethers.getContractFactory("GreenTon")).deploy(admin.address, oracle.address);
  const m = await (await ethers.getContractFactory("Market")).deploy(await g.getAddress(), treasury.address, feeBps);
  await g.registerParcel(owner.address, "IBERA1", 1000, "x");
  await g.connect(oracle).submitVerification("IBERA1", 202510, 720, 100, EVIDENCE);
  await g.connect(owner).setOperator(await m.getAddress(), true);
  return { g, m, admin, oracle, owner, buyer, treasury, stranger };
}

describe("Market", () => {
  it("listar pone el lote en custodia del mercado", async () => {
    const { g, m, owner } = await setup();
    await m.connect(owner).list("IBERA1", 202510, 40, PRICE);
    expect(await g.lotBalance(owner.address, "IBERA1", 202510)).to.equal(60);
    expect(await g.lotBalance(await m.getAddress(), "IBERA1", 202510)).to.equal(40);
    const o = await m.getOffer(0);
    expect(o.available).to.equal(40);
    expect(o.open).to.equal(true);
    expect(o.seller).to.equal(owner.address);
  });

  it("sin autorizar al mercado como operador no se puede listar", async () => {
    const { g, m, owner } = await setup();
    await g.connect(owner).setOperator(await m.getAddress(), false);
    await expect(m.connect(owner).list("IBERA1", 202510, 10, PRICE)).to.be.revertedWithCustomError(g, "NotAuthorized");
  });

  it("no se lista más de lo que se tiene, ni a precio cero", async () => {
    const { g, m, owner } = await setup();
    await expect(m.connect(owner).list("IBERA1", 202510, 101, PRICE)).to.be.revertedWithCustomError(g, "InsufficientBalance");
    await expect(m.connect(owner).list("IBERA1", 202510, 0, PRICE)).to.be.revertedWithCustomError(m, "InvalidAmount");
    await expect(m.connect(owner).list("IBERA1", 202510, 10, 0)).to.be.revertedWithCustomError(m, "InvalidPrice");
  });

  it("compra y quema en una sola transacción, y reparte el pago con comisión", async () => {
    const { g, m, owner, buyer, treasury } = await setup();
    await m.connect(owner).list("IBERA1", 202510, 40, PRICE);
    const paid = 10n * PRICE;
    const fee = (paid * BigInt(FEE_BPS)) / 10_000n;

    const tx = m.connect(buyer).buyAndRetire(0, 10, "Empresa Demo SA", { value: paid });
    await expect(tx).to.changeEtherBalances([buyer, owner, treasury], [-paid, paid - fee, fee]);
    await expect(tx).to.emit(m, "Purchased").withArgs(0, buyer.address, "IBERA1", 202510, 10, paid, fee, 0);

    expect(await g.totalRetired()).to.equal(10);
    expect(await g.totalSupply()).to.equal(90);
    const r = await g.getRetirement(0);
    expect(r.holder).to.equal(await m.getAddress());
    expect(r.beneficiary).to.equal("Empresa Demo SA");
    expect(r.amount).to.equal(10);
    expect(await g.lotBalance(await m.getAddress(), "IBERA1", 202510)).to.equal(30);
    const p = await m.getPurchase(0);
    expect(p.buyer).to.equal(buyer.address);
    expect(p.paid).to.equal(paid);
    expect(p.fee).to.equal(fee);
    expect(p.retirementId).to.equal(0);
    expect((await m.getOffer(0)).available).to.equal(30);
  });

  it("sin comisión, todo el pago va al vendedor", async () => {
    const { m, owner, buyer, treasury } = await setup(0);
    await m.connect(owner).list("IBERA1", 202510, 5, PRICE);
    await expect(m.connect(buyer).buyAndRetire(0, 5, "x", { value: 5n * PRICE }))
      .to.changeEtherBalances([owner, treasury], [5n * PRICE, 0n]);
  });

  it("el pago debe ser exacto", async () => {
    const { m, owner, buyer } = await setup();
    await m.connect(owner).list("IBERA1", 202510, 10, PRICE);
    await expect(m.connect(buyer).buyAndRetire(0, 5, "x", { value: 5n * PRICE - 1n })).to.be.revertedWithCustomError(m, "WrongPayment");
    await expect(m.connect(buyer).buyAndRetire(0, 5, "x", { value: 5n * PRICE + 1n })).to.be.revertedWithCustomError(m, "WrongPayment");
  });

  it("no se compra más de lo disponible y la oferta se cierra al agotarse", async () => {
    const { m, owner, buyer } = await setup();
    await m.connect(owner).list("IBERA1", 202510, 10, PRICE);
    await expect(m.connect(buyer).buyAndRetire(0, 11, "x", { value: 11n * PRICE })).to.be.revertedWithCustomError(m, "AmountExceedsAvailable");
    await m.connect(buyer).buyAndRetire(0, 10, "x", { value: 10n * PRICE });
    expect((await m.getOffer(0)).open).to.equal(false);
    await expect(m.connect(buyer).buyAndRetire(0, 1, "x", { value: PRICE })).to.be.revertedWithCustomError(m, "OfferClosed");
  });

  it("una oferta inexistente se rechaza", async () => {
    const { m, buyer } = await setup();
    await expect(m.connect(buyer).buyAndRetire(7, 1, "x", { value: PRICE })).to.be.revertedWithCustomError(m, "OfferNotFound");
  });

  it("si falla el pago al vendedor no se quema nada", async () => {
    const { g, m, owner, oracle, buyer } = await setup();
    // Un vendedor-contrato que rechaza HBAR hace fallar la compra completa.
    const Rejecter = await ethers.getContractFactory("RejectingSeller");
    const r = await Rejecter.deploy();
    await g.registerParcel(await r.getAddress(), "RECH1", 10, "x");
    await g.connect(oracle).submitVerification("RECH1", 202510, 700, 10, EVIDENCE);
    await r.listOn(await m.getAddress(), "RECH1", 202510, 10, PRICE);
    await expect(m.connect(buyer).buyAndRetire(0, 1, "x", { value: PRICE })).to.be.revertedWithCustomError(m, "PaymentFailed");
    expect(await g.totalRetired()).to.equal(0);
    expect((await m.getOffer(0)).available).to.equal(10);
    expect(owner.address).to.not.equal(await r.getAddress());
  });

  it("solo el vendedor cancela y recupera el remanente", async () => {
    const { g, m, owner, buyer, stranger } = await setup();
    await m.connect(owner).list("IBERA1", 202510, 40, PRICE);
    await m.connect(buyer).buyAndRetire(0, 15, "x", { value: 15n * PRICE });
    await expect(m.connect(stranger).cancel(0)).to.be.revertedWithCustomError(m, "NotSeller");
    await expect(m.connect(owner).cancel(0)).to.emit(m, "Cancelled").withArgs(0, 25);
    expect(await g.lotBalance(owner.address, "IBERA1", 202510)).to.equal(60 + 25);
    expect((await m.getOffer(0)).open).to.equal(false);
    await expect(m.connect(owner).cancel(0)).to.be.revertedWithCustomError(m, "OfferClosed");
  });

  it("la comisión no puede superar el tope", async () => {
    const [admin, oracle, , , treasury] = await ethers.getSigners();
    const g = await (await ethers.getContractFactory("GreenTon")).deploy(admin.address, oracle.address);
    const M = await ethers.getContractFactory("Market");
    await expect(M.deploy(await g.getAddress(), treasury.address, 1001)).to.be.revertedWithCustomError(M, "InvalidFee");
    await M.deploy(await g.getAddress(), treasury.address, 1000);
  });

  it("la comisión se redondea hacia abajo, a favor del vendedor", async () => {
    const { m, owner, buyer, treasury } = await setup(500);
    await m.connect(owner).list("IBERA1", 202510, 1, 19n); // 19 tinybars → 5 % = 0,95 → 0
    await expect(m.connect(buyer).buyAndRetire(0, 1, "x", { value: 19n }))
      .to.changeEtherBalances([owner, treasury], [19n, 0n]);
  });
});
