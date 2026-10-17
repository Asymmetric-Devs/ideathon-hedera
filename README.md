# Dosel

*Dosel* es la copa del bosque vista desde arriba, lo que mide el satélite. Créditos de carbono de **bosque nativo** del NEA/Gran Chaco, **verificados por satélite** y emitidos/retirados en **Hedera**.
Proyecto para el IDEATHON Neatech 2026 · **Hedera Track · Hello Future**.

**No confiamos en la palabra del dueño del campo.** Un oráculo calcula el NDVI real de Sentinel-2 sobre el polígono GPS del predio, **publica esa evidencia en Hedera Consensus Service** y solo con ese dato el contrato (HSCS) emite GreenTon (1 GTON = 1 tCO₂e). Si el NDVI cae, el contrato **congela el predio y frena la emisión**. Quien compensa su huella **compra y retira (quema) en una sola transacción**: nadie puede revenderlos y el registro es público.

**Demo en vivo:** `PENDIENTE: URL de la web` · para comprar, publicar o retirar hace falta una billetera EVM (MetaMask) en Hedera Testnet con HBAR de prueba.

## El problema y por qué blockchain

- **Problema:** un crédito de carbono vale lo que vale la prueba que tiene detrás, y hoy esa prueba suele ser un PDF firmado por quien cobra. En el norte argentino se desmontaron ~119.886 ha en 2024 y se perdieron 210.702 ha en 2025 (Greenpeace), y el marco legal del mercado de carbono sigue en el Congreso. Fuentes y límites: [`docs/validacion.md`](docs/validacion.md).
- **Por qué blockchain, y por qué una base de datos no alcanza:** propietario, comprador, operador y auditor no confían entre sí y no hay un registro único en el que todos confíen. [`docs/justificacion-blockchain.md`](docs/justificacion-blockchain.md).

## Declaración de originalidad (regla 1)

Esta entrega **extiende un proyecto anterior**: la primera versión de Dosel, hecha durante este mismo ideathon para el track de Stellar (repositorio [SixtoArrejin/ideathon](https://github.com/SixtoArrejin/ideathon), contratos Soroban en Rust, Freighter, XLM). Lo que existía y lo que se hizo para Hedera:

| | Qué |
|---|---|
| **Existía antes (versión de Stellar)** | La idea y el dominio ([`GLOSSARY.md`](GLOSSARY.md)); el cálculo de NDVI con Sentinel-2 (`oracle/ndvi.py`, `crosscheck.py`, `news.py`) y las mediciones reales de los tres predios; la interfaz web (React + Vite: portada, predios, mercado, radar, certificado, transparencia); la investigación (`docs/validacion.md`), la marca y el modelo de negocio |
| **Nuevo para Hedera** | `contracts/GreenTon.sol` y `contracts/Market.sol` (Solidity para HSCS, reescritos desde cero a partir de las reglas de los contratos de Rust, con `transferFrom`/operadores, pago en HBAR y guardas propias de la EVM); las 28 pruebas (`test/`); la **publicación de la evidencia en HCS** y su hash dentro del lote (`scripts/submit-verification.ts`, `audit.ts`); el despliegue y la demo en Hedera (`scripts/`); toda la capa de cadena de la web (`web/src/chain.ts`, `wallet.ts`, `config.ts`: ethers, billetera EVM, mirror node, HashScan); el oráculo dividido en medir (Python) y publicar (Node); los ADR [0001](docs/adr/0001-lotes-y-compra-retiro-atomico.md) (adaptado) y [0002](docs/adr/0002-servicios-de-hedera.md); la justificación de blockchain; el deck rehecho con la estructura del track |
| **No se reutilizó** | Ningún contrato, ID, dirección ni transacción de Stellar. Los logs de transacciones de Stellar se vaciaron: `web/public/verifications.json` y `retirements.json` solo contienen lo que se publique en Hedera |

## Uso de IA (declarado)

Construido con **Claude Code** (Anthropic): contratos, oráculo, frontend, documentación e investigación, en ambas versiones. Las decisiones de alcance fueron del equipo.

## Servicios de Hedera usados

| Servicio | Para qué |
|---|---|
| **Hedera Smart Contract Service (HSCS)** | `GreenTon` (lotes, emisión solo por el oráculo, congelamiento, retiro) y `Market` (compra y quema atómica pagada en HBAR) |
| **Hedera Consensus Service (HCS)** | Topic donde el oráculo publica la evidencia de cada verificación (escena Sentinel-2, NDVI, polígono). Solo su clave puede escribir; el contrato guarda el SHA-256 del mensaje |
| **HBAR** | Medio de pago del mercado |

Qué otros servicios se evaluaron y por qué no están (HTS por lote, Guardian, Stablecoin Studio, Agent Kit): [ADR 0002](docs/adr/0002-servicios-de-hedera.md). Herramientas: Hardhat, ethers, Hedera SDK (`@hashgraph/sdk`), relay JSON-RPC (Hashio), mirror node, HashScan.

## Datos on-chain (Hedera Testnet)

Estado al 17/10: **61.639 GTON en circulación y 100 retiradas en 1 compra**. HashScan muestra siempre el estado actual.

| Qué | ID / enlace HashScan |
|---|---|
| Cuenta del oráculo (Hedera) | [`0.0.11061044`](https://hashscan.io/testnet/account/0.0.11061044) · EVM `0x7D2aE674965dD13Afc2A34a9Dba0cF8664896479` |
| Contrato GreenTon | [`0xefD852E3a934FAd4814A89d02b65C8BefB77528a`](https://hashscan.io/testnet/contract/0xefD852E3a934FAd4814A89d02b65C8BefB77528a) · deploy [`0x7f443cc9…`](https://hashscan.io/testnet/transaction/0x7f443cc94ee1391b710f6958033833230350902fa324010d55924096edf3e0ae) |
| Contrato Mercado | [`0x00D031d2114FA3059E42a5f3190211Fa2638E98B`](https://hashscan.io/testnet/contract/0x00D031d2114FA3059E42a5f3190211Fa2638E98B) · deploy [`0x05d2ffc4…`](https://hashscan.io/testnet/transaction/0x05d2ffc4b0c90de9df90796a53ff4897cae06f62bd1740906105fbb86841e842) |
| Admin / propietario / comprador | `0x87cd615287625BD0c2888Ec79A733aE4E78e91D5` · `0x0706e41658b9b9b6Bb2B94E6A5d20d3e7A917062` · `0x19B00052928Ff5FDB3a0419C5Abb4AaBbc555100` |
| Alta de los predios IMPEN1, CHACO1, TACOP1 | [`0xda4e1a34…`](https://hashscan.io/testnet/transaction/0xda4e1a3491c0563f47c8cddc12c5b8623517c99c741bf0dc3dff96cd4b8ba7f8) · [`0x9d565ad8…`](https://hashscan.io/testnet/transaction/0x9d565ad80873e471876a847e208fcdfb4380aef32b06da70a9c00117a847e56b) · [`0xce9a45e9…`](https://hashscan.io/testnet/transaction/0xce9a45e9fcffd399a60d65ea12a81e6fadb1a6ae1eb6554d54ab1c22927bab73) |
| IMPEN1 · lote 2019 (línea base) NDVI 0,768 → emite 14.082 | [`0xc7d09f7c…`](https://hashscan.io/testnet/transaction/0xc7d09f7c4f89efc209c0d9a2cfc337ec199033cc49b01d305273483d3c43e90c) |
| IMPEN1 · lote 2026 NDVI 0,769 → emite 14.099 | [`0x323ea1b1…`](https://hashscan.io/testnet/transaction/0x323ea1b105b8a451c0a76c848ef4d8965d76dc6201f2e9f3a5562d0fbaec66b2) |
| CHACO1 · lote 2019 → emite 13.997 | [`0xf8f0f1be…`](https://hashscan.io/testnet/transaction/0xf8f0f1be2f921c1d8b8b1a4afbb295fa3660ec35eb99272d19a6e1386710112d) |
| CHACO1 · lote 2026 → emite 14.083 | [`0x3a448871…`](https://hashscan.io/testnet/transaction/0x3a448871df07f95c78bb77e324472f97efd471c5b02b227930d025074ef6d8f6) |
| TACOP1 · lote 2019 NDVI 0,814 → emite 5.478 | [`0xc1e621e7…`](https://hashscan.io/testnet/transaction/0xc1e621e7c47fad9df2298af352cb88e4d31794842d85b80a3a025cb8c449fa9d) |
| **TACOP1 · 2026 NDVI 0,612 → CONGELA, no hay lote nuevo** | [`0x6a018ce8…`](https://hashscan.io/testnet/transaction/0x6a018ce89cb0089e6879ce7a5ea5b2305aeb018ff8254b45ac870137ca74f6ff) |
| Oferta 0: 3.000 t del lote IMPEN1 2026 a 0,01 HBAR/t, en custodia del mercado | [`0x97b98be1…`](https://hashscan.io/testnet/transaction/0x97b98be17c5b1748096fd9d5f718efd71edb54712e3b7498d55a55f702e2b4f9) |
| **Compra y quema atómica:** 100 t de IMPEN1 2026, el comprador paga 1 HBAR (vendedor 0,95, tesorería 0,05) y se quema a nombre de «Empresa Demo SA - huella 2026» | [`0x8074f3dc…`](https://hashscan.io/testnet/transaction/0x8074f3dcdb1d53597bf314717e35829c442814c82e8625bd9e812093c3118e36) |
| Topic de HCS (evidencia) | **Pendiente**: HCS usa gRPC y la red donde se desplegó lo bloquea. Se crea y se publica con `npm run hcs` desde otra red; los hashes de evidencia ya están en los lotes |

