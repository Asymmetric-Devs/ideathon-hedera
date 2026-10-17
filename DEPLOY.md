# Despliegue en Hedera Testnet

Requisitos: Node 20+ (probado con 24), Python 3.11+ solo si vas a medir NDVI de nuevo.

## 1. Cuenta de Hedera Testnet

1. Entrá a <https://portal.hedera.com>, creá una cuenta de **testnet** y elegí clave **ECDSA**.
2. Copiá el Account ID (`0.0.xxxxxxx`) y la **HEX Encoded Private Key**.
3. Armá el `.env` (no se versiona):

```sh
cp .env.example .env
# HEDERA_ACCOUNT_ID=0.0.xxxxxxx
# HEDERA_PRIVATE_KEY=0x<clave hex ECDSA>
```

Esa cuenta hace de **oráculo**: firma las verificaciones en el contrato y es la única que puede escribir en el topic de HCS. También fondea (20 HBAR cada una) las cuentas de la demo: admin, propietario y comprador, que el script genera y guarda en `.wallets.json` (no se versiona). Hace falta saldo: el faucet del portal da HBAR de testnet.

## 2. Contratos, topic y predios

```sh
npm install
npm test             # 28 pruebas locales, sin red
npm run deploy       # crea el topic de HCS, despliega GreenTon y Mercado, registra los predios
```

Imprime los IDs y los enlaces a HashScan, y guarda todo en `deployments/hedera-testnet.json`.

## 3. Flujo completo de la demo

```sh
npm run demo         # evidencia → HCS, verificación → HSCS, oferta, compra y quema atómica
npm run audit        # baja cada mensaje de HCS, calcula su SHA-256 y lo compara con el hash del lote
```

`demo` reproduce las mediciones de `oracle/evidence/*.json` (Sentinel-2 real). Para medir de nuevo con el satélite y publicar:

```sh
python3 -m venv oracle/.venv && oracle/.venv/bin/pip install pystac-client planetary-computer rasterio numpy
oracle/.venv/bin/python oracle/run.py verify TACOP1 202604 "2026-03-01/2026-04-30"   # mide, publica en HCS y firma en el contrato
```

## 4. Web

```sh
cd web && npm install
# las tres direcciones salen de deployments/hedera-testnet.json (greenton, market, topicId)
VITE_GREENTON_ID=0x... VITE_MARKET_ID=0x... VITE_TOPIC_ID=0.0.... npm run dev
```

Para publicarla (por ejemplo en Vercel), definí esas tres variables en el proyecto (`VITE_ADMIN_ADDRESS`, `VITE_ORACLE_ADDRESS` y `VITE_OWNER_ADDRESS` son opcionales y llenan la lista de cuentas de Transparencia) y compilá con `npm run build`.

Para publicar, comprar o retirar desde la web hace falta una billetera EVM (MetaMask, Brave, Rabby) con **Hedera Testnet** (chain ID 296; la web la agrega sola) y HBAR de prueba.

## Unidades de HBAR

El EVM de Hedera ve `msg.value` y los saldos en **tinybars** (1 HBAR = 10⁸), mientras que el relay JSON-RPC (ethers, MetaMask) trabaja en **weibars** (1 tinybar = 10¹⁰ weibars) y convierte. Los precios de las ofertas y `Purchase.paid` están en tinybars; `scripts/demo.ts` y `web/src/chain.ts` multiplican por `WEIBAR_PER_TINYBAR` al enviar.

## Si algo falla

- `INSUFFICIENT_PAYER_BALANCE` o `insufficient funds`: la cuenta no tiene HBAR de testnet.
- `INVALID_SIGNATURE` al publicar en HCS: la clave de `.env` no es la del Account ID, o no es ECDSA.
- `WrongPayment` al comprar: el valor enviado no es `toneladas × precio` exacto en tinybars (revisá la conversión de unidades).
