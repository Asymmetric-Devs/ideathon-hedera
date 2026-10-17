// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IGreenTon {
    function transfer(address to, string calldata parcel, uint32 period, uint256 amount) external;
    function transferFrom(address from, address to, string calldata parcel, uint32 period, uint256 amount) external;
    function retire(string calldata parcel, uint32 period, uint256 amount, string calldata beneficiary) external returns (uint256);
}

/// @title Mercado de GreenTon: compra y quema atómica de lotes, pagado en HBAR.
/// @notice El vendedor publica una oferta sobre un lote (predio, período) y el mercado custodia esas toneladas.
/// El comprador paga en HBAR y, en la misma transacción, el mercado reparte el pago (vendedor y comisión de
/// plataforma) y retira (quema) las toneladas a nombre del beneficiario. No hay compra sin quema.
/// @dev Los importes están en tinybars (1 HBAR = 100.000.000 tinybars), la unidad con la que el EVM de Hedera
/// ve `msg.value`. Quien llama por JSON-RPC (ethers, MetaMask) envía weibars: el relay los convierte (1 tinybar = 1e10 weibars).
contract Market {
    /// Comisión máxima de la plataforma, en puntos básicos (1000 = 10 %).
    uint32 public constant MAX_FEE_BPS = 1_000;
    uint256 private constant BPS = 10_000;

    IGreenTon public immutable greenton;
    address public immutable treasury;
    uint32 public immutable feeBps;

    struct Offer {
        address seller;
        string parcel;
        uint32 period;
        uint256 available;
        /// Tinybars por tonelada.
        uint256 pricePerTon;
        bool open;
    }

    struct Purchase {
        address buyer;
        uint256 offerId;
        uint256 amount;
        /// Total pagado por el comprador (incluye la comisión).
        uint256 paid;
        /// Parte de `paid` que fue a la tesorería; el vendedor recibió `paid - fee`.
        uint256 fee;
        uint256 retirementId;
    }

    Offer[] private _offers;
    Purchase[] private _purchases;
    bool private _locked;

    event Listed(uint256 indexed offerId, address indexed seller, string parcel, uint32 period, uint256 amount, uint256 pricePerTon);
    event Purchased(
        uint256 indexed offerId,
        address indexed buyer,
        string parcel,
        uint32 period,
        uint256 amount,
        uint256 paid,
        uint256 fee,
        uint256 retirementId
    );
    event Cancelled(uint256 indexed offerId, uint256 returned);

    error InvalidAmount();
    error InvalidPrice();
    error OfferNotFound();
    error OfferClosed();
    error AmountExceedsAvailable();
    error NotSeller();
    error InvalidFee();
    error WrongPayment();
    error PaymentFailed();
    error Reentrancy();

    modifier nonReentrant() {
        if (_locked) revert Reentrancy();
        _locked = true;
        _;
        _locked = false;
    }

    /// `feeBps_` es la comisión de la plataforma sobre cada compra (0 a `MAX_FEE_BPS`) y `treasury_` la cuenta que la recibe.
    constructor(address greenton_, address treasury_, uint32 feeBps_) {
        if (feeBps_ > MAX_FEE_BPS) revert InvalidFee();
        greenton = IGreenTon(greenton_);
        treasury = treasury_;
        feeBps = feeBps_;
    }

    /// Publica una oferta sobre un lote y lo pone en custodia del mercado. Devuelve el ID.
    /// El vendedor debe haber autorizado antes al mercado como operador en GreenTon (`setOperator`).
    function list(string calldata parcel, uint32 period, uint256 amount, uint256 pricePerTon) external returns (uint256 id) {
        if (amount == 0) revert InvalidAmount();
        if (pricePerTon == 0) revert InvalidPrice();
        greenton.transferFrom(msg.sender, address(this), parcel, period, amount);
        id = _offers.length;
        _offers.push(Offer(msg.sender, parcel, period, amount, pricePerTon, true));
        emit Listed(id, msg.sender, parcel, period, amount, pricePerTon);
    }

    /// Cobra al comprador, paga al vendedor (menos la comisión, que va a la tesorería) y quema `amount`
    /// toneladas del lote a nombre de `beneficiary`, todo en la misma transacción. Si algo falla, no pasa nada.
    /// El pago debe ser exacto (`amount * pricePerTon`). La comisión se redondea hacia abajo, a favor del vendedor.
    function buyAndRetire(uint256 offerId, uint256 amount, string calldata beneficiary) external payable nonReentrant returns (uint256 id) {
        if (offerId >= _offers.length) revert OfferNotFound();
        Offer storage o = _offers[offerId];
        if (!o.open) revert OfferClosed();
        if (amount == 0) revert InvalidAmount();
        if (amount > o.available) revert AmountExceedsAvailable();
        uint256 paid = amount * o.pricePerTon;
        if (msg.value != paid) revert WrongPayment();
        uint256 fee = (paid * feeBps) / BPS;

        o.available -= amount;
        o.open = o.available > 0;
        address seller = o.seller;
        string memory parcel = o.parcel;
        uint32 period = o.period;

        _pay(seller, paid - fee);
        if (fee > 0) _pay(treasury, fee);
        uint256 retirementId = greenton.retire(parcel, period, amount, beneficiary);

        id = _purchases.length;
        _purchases.push(Purchase(msg.sender, offerId, amount, paid, fee, retirementId));
        emit Purchased(offerId, msg.sender, parcel, period, amount, paid, fee, retirementId);
    }

    /// Cierra la oferta y devuelve al vendedor las toneladas no vendidas.
    function cancel(uint256 offerId) external nonReentrant {
        if (offerId >= _offers.length) revert OfferNotFound();
        Offer storage o = _offers[offerId];
        if (o.seller != msg.sender) revert NotSeller();
        if (!o.open) revert OfferClosed();
        uint256 returned = o.available;
        o.available = 0;
        o.open = false;
        greenton.transfer(msg.sender, o.parcel, o.period, returned);
        emit Cancelled(offerId, returned);
    }

    function _pay(address to, uint256 value) private {
        (bool ok, ) = payable(to).call{value: value}("");
        if (!ok) revert PaymentFailed();
    }

    // ---- Lectura ----
    function getOffer(uint256 offerId) external view returns (Offer memory) {
        if (offerId >= _offers.length) revert OfferNotFound();
        return _offers[offerId];
    }

    function offerCount() external view returns (uint256) {
        return _offers.length;
    }

    function getPurchase(uint256 purchaseId) external view returns (Purchase memory) {
        return _purchases[purchaseId];
    }

    function purchaseCount() external view returns (uint256) {
        return _purchases.length;
    }
}
