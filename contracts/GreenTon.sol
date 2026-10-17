// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title GreenTon: créditos de carbono verificados por satélite (Dosel) sobre Hedera Smart Contract Service.
/// @notice 1 GreenTon = 1 tCO2e. Solo el oráculo emite, una vez por predio y período. Solo el admin
/// (entidad auditora) registra predios, tras verificar titularidad y polígono fuera de la cadena.
/// Cada emisión crea un lote (predio, período): saldos, transferencias y retiros son por lote, así que
/// cualquier tonelada se puede rastrear hasta la verificación satelital que la originó. La evidencia de esa
/// verificación (escena Sentinel-2, NDVI, polígono) se publica en un topic de Hedera Consensus Service y su
/// hash queda guardado en el lote (`evidence`). Si el NDVI cae bajo el umbral absoluto o respecto de la
/// línea base, el predio se congela. Retirar quema los créditos y deja registro público del beneficiario.
contract GreenTon {
    /// NDVI en milésimas (0.612 => 612).
    int32 public constant NDVI_MIN_MILLI = 400;
    /// Caída máxima tolerada respecto de la línea base (milésimas).
    int32 public constant NDVI_MAX_DROP_MILLI = 150;

    string public constant name = "GreenTon";
    string public constant symbol = "GTON";
    uint8 public constant decimals = 0;

    address public immutable admin;
    address public immutable oracle;

    struct Parcel {
        address owner;
        uint32 hectares;
        /// Bounding box "lon_min,lat_min,lon_max,lat_max" (WGS84).
        string bbox;
        int32 baselineNdviMilli;
        int32 lastNdviMilli;
        bool frozen;
        uint256 issuedTco2e;
        bool exists;
    }

    /// Lote: las toneladas emitidas para un predio en un período.
    struct LotInfo {
        string parcel;
        uint32 period;
        uint256 minted;
        int32 ndviMilli;
        uint64 timestamp;
        /// Hash (SHA-256) del mensaje de evidencia publicado en el topic de HCS.
        bytes32 evidence;
        bool exists;
    }

    struct LotBalance {
        string parcel;
        uint32 period;
        uint256 amount;
    }

    struct Retirement {
        address holder;
        string parcel;
        uint32 period;
        uint256 amount;
        string beneficiary;
        uint64 timestamp;
    }

    mapping(bytes32 => Parcel) private _parcels;
    mapping(bytes32 => LotInfo) private _lots;
    mapping(bytes32 => bool) private _issued;
    mapping(address => mapping(bytes32 => uint256)) private _balance;
    /// Lotes con saldo positivo de cada cuenta, con índice para quitarlos en O(1).
    mapping(address => bytes32[]) private _held;
    mapping(address => mapping(bytes32 => uint256)) private _heldPos; // posición + 1
    Retirement[] private _retirements;
    /// Operadores autorizados por un titular para mover sus lotes (lo usa el mercado para custodiar ofertas).
    mapping(address => mapping(address => bool)) public isOperator;

    uint256 public totalSupply;
    uint256 public totalRetired;

    event ParcelRegistered(string indexed parcelHash, string parcel, address indexed owner);
    event Minted(string indexed parcelHash, string parcel, uint32 period, uint256 amount, int32 ndviMilli, bytes32 evidence);
    event Frozen(string indexed parcelHash, string parcel, uint32 period, int32 ndviMilli, bytes32 evidence);
    event Unfrozen(string indexed parcelHash, string parcel);
    event OperatorSet(address indexed holder, address indexed operator, bool approved);
    event Transferred(address indexed from, address indexed to, string parcel, uint32 period, uint256 amount);
    event Retired(address indexed holder, uint256 indexed id, string parcel, uint32 period, uint256 amount, string beneficiary);

    error NotAdmin();
    error NotOracle();
    error ParcelExists();
    error ParcelNotFound();
    error ParcelFrozen();
    error PeriodAlreadyIssued();
    error InvalidAmount();
    error InsufficientBalance();
    error NotFrozen();
    error InvalidAddress();
    error NotAuthorized();

    constructor(address admin_, address oracle_) {
        if (admin_ == address(0) || oracle_ == address(0)) revert InvalidAddress();
        admin = admin_;
        oracle = oracle_;
    }

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    modifier onlyOracle() {
        if (msg.sender != oracle) revert NotOracle();
        _;
    }

    // ---- Claves ----
    function _pk(string memory parcel) private pure returns (bytes32) {
        return keccak256(bytes(parcel));
    }

    /// Identificador del lote (predio, período).
    function lotId(string memory parcel, uint32 period) public pure returns (bytes32) {
        return keccak256(abi.encode(parcel, period));
    }

    // ---- Registro de predios ----
    /// El admin da de alta un predio ya auditado a nombre de `owner`. La línea base se fija en la primera verificación.
    function registerParcel(address owner, string calldata parcel, uint32 hectares, string calldata bbox) external onlyAdmin {
        if (owner == address(0)) revert InvalidAddress();
        bytes32 k = _pk(parcel);
        if (_parcels[k].exists) revert ParcelExists();
        _parcels[k] = Parcel(owner, hectares, bbox, 0, 0, false, 0, true);
        emit ParcelRegistered(parcel, parcel, owner);
    }

    // ---- Verificación satelital (solo oráculo) ----
    /// El oráculo reporta el NDVI del período y las toneladas verificadas. Emite al propietario un lote
    /// (predio, período) salvo que el predio esté (o quede) congelado. Devuelve las toneladas emitidas.
    /// `evidence` es el hash del mensaje que el oráculo publicó antes en el topic de HCS.
    function submitVerification(string calldata parcel, uint32 period, int32 ndviMilli, uint256 tco2e, bytes32 evidence)
        external
        onlyOracle
        returns (uint256)
    {
        bytes32 k = _pk(parcel);
        Parcel storage p = _parcels[k];
        if (!p.exists) revert ParcelNotFound();
        if (p.frozen) revert ParcelFrozen();
        bytes32 issuedKey = lotId(parcel, period);
        if (_issued[issuedKey]) revert PeriodAlreadyIssued();

        // Primera verificación: fija la línea base.
        if (p.baselineNdviMilli == 0) p.baselineNdviMilli = ndviMilli;
        bool dropped = p.baselineNdviMilli - ndviMilli > NDVI_MAX_DROP_MILLI;
        p.lastNdviMilli = ndviMilli;
        // El período queda consumido aunque se congele: no se puede reintentar.
        _issued[issuedKey] = true;

        if (ndviMilli < NDVI_MIN_MILLI || dropped) {
            p.frozen = true;
            emit Frozen(parcel, parcel, period, ndviMilli, evidence);
            return 0;
        }

        p.issuedTco2e += tco2e;
        _lots[issuedKey] = LotInfo(parcel, period, tco2e, ndviMilli, uint64(block.timestamp), evidence, true);
        if (tco2e > 0) _credit(p.owner, issuedKey, tco2e);
        totalSupply += tco2e;
        emit Minted(parcel, parcel, period, tco2e, ndviMilli, evidence);
        return tco2e;
    }

    /// El admin (auditor humano) levanta el congelamiento tras revisar el predio.
    function unfreeze(string calldata parcel) external onlyAdmin {
        Parcel storage p = _parcels[_pk(parcel)];
        if (!p.exists) revert ParcelNotFound();
        if (!p.frozen) revert NotFrozen();
        p.frozen = false;
        p.baselineNdviMilli = p.lastNdviMilli;
        emit Unfrozen(parcel, parcel);
    }

    // ---- Saldos por lote ----
    function _credit(address a, bytes32 lot, uint256 amount) private {
        if (_balance[a][lot] == 0) {
            _held[a].push(lot);
            _heldPos[a][lot] = _held[a].length;
        }
        _balance[a][lot] += amount;
    }

    function _debit(address a, bytes32 lot, uint256 amount) private {
        if (amount == 0) revert InvalidAmount();
        uint256 bal = _balance[a][lot];
        if (bal < amount) revert InsufficientBalance();
        _balance[a][lot] = bal - amount;
        if (bal == amount) {
            uint256 pos = _heldPos[a][lot];
            bytes32 last = _held[a][_held[a].length - 1];
            _held[a][pos - 1] = last;
            _heldPos[a][last] = pos;
            _held[a].pop();
            delete _heldPos[a][lot];
        }
    }

    /// Saldo total de la cuenta, sumando todos sus lotes.
    function balance(address who) external view returns (uint256 total) {
        bytes32[] storage h = _held[who];
        for (uint256 i = 0; i < h.length; i++) total += _balance[who][h[i]];
    }

    function lotBalance(address who, string calldata parcel, uint32 period) external view returns (uint256) {
        return _balance[who][lotId(parcel, period)];
    }

    function lotsOf(address who) external view returns (LotBalance[] memory out) {
        bytes32[] storage h = _held[who];
        out = new LotBalance[](h.length);
        for (uint256 i = 0; i < h.length; i++) {
            LotInfo storage l = _lots[h[i]];
            out[i] = LotBalance(l.parcel, l.period, _balance[who][h[i]]);
        }
    }

    function getLot(string calldata parcel, uint32 period) external view returns (LotInfo memory) {
        return _lots[lotId(parcel, period)];
    }

    /// Autoriza (o revoca) a `operator` para mover lotes del titular con `transferFrom`.
    function setOperator(address operator, bool approved) external {
        isOperator[msg.sender][operator] = approved;
        emit OperatorSet(msg.sender, operator, approved);
    }

    function transfer(address to, string calldata parcel, uint32 period, uint256 amount) external {
        _move(msg.sender, to, parcel, period, amount);
    }

    /// Mueve un lote de `from` a `to`. Lo puede llamar el titular o un operador que el titular autorizó.
    function transferFrom(address from, address to, string calldata parcel, uint32 period, uint256 amount) external {
        if (msg.sender != from && !isOperator[from][msg.sender]) revert NotAuthorized();
        _move(from, to, parcel, period, amount);
    }

    function _move(address from, address to, string calldata parcel, uint32 period, uint256 amount) private {
        if (to == address(0)) revert InvalidAddress();
        bytes32 lot = lotId(parcel, period);
        _debit(from, lot, amount);
        _credit(to, lot, amount);
        emit Transferred(from, to, parcel, period, amount);
    }

    /// Retira (quema) créditos de un lote del que quien llama es titular, para compensar huella.
    /// Irreversible y auditable. Devuelve el ID del retiro.
    function retire(string calldata parcel, uint32 period, uint256 amount, string calldata beneficiary) external returns (uint256 id) {
        _debit(msg.sender, lotId(parcel, period), amount);
        totalSupply -= amount;
        totalRetired += amount;
        id = _retirements.length;
        _retirements.push(Retirement(msg.sender, parcel, period, amount, beneficiary, uint64(block.timestamp)));
        emit Retired(msg.sender, id, parcel, period, amount, beneficiary);
    }

    // ---- Lectura ----
    function getParcel(string calldata parcel) external view returns (Parcel memory) {
        Parcel memory p = _parcels[_pk(parcel)];
        if (!p.exists) revert ParcelNotFound();
        return p;
    }

    function isPeriodIssued(string calldata parcel, uint32 period) external view returns (bool) {
        return _issued[lotId(parcel, period)];
    }

    function retirementCount() external view returns (uint256) {
        return _retirements.length;
    }

    function getRetirement(uint256 id) external view returns (Retirement memory) {
        return _retirements[id];
    }
}
