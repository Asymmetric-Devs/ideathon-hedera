# Dosel

*Dosel* es la copa del bosque vista desde arriba, lo que mide el satélite. Créditos de carbono de **bosque nativo** del NEA/Gran Chaco, **verificados por satélite** y emitidos/retirados en **Hedera**.
Proyecto para el IDEATHON Neatech 2026 · **Hedera Track · Hello Future**.

**No confiamos en la palabra del dueño del campo.** Un oráculo calcula el NDVI real de Sentinel-2 sobre el polígono GPS del predio, **publica esa evidencia en Hedera Consensus Service** y solo con ese dato el contrato (HSCS) emite GreenTon (1 GTON = 1 tCO₂e). Si el NDVI cae, el contrato **congela el predio y frena la emisión**. Quien compensa su huella **compra y retira (quema) en una sola transacción**: nadie puede revenderlos y el registro es público.

**Demo en vivo:** `PENDIENTE: URL de la web desplegada sobre Hedera Testnet` · para comprar, publicar o retirar hace falta una billetera EVM (MetaMask) en Hedera Testnet con HBAR de prueba.

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

> **PENDIENTE hasta correr la demo.** Este bloque se completa con lo que imprime `npm run deploy` y `npm run demo` (también queda en `deployments/hedera-testnet.json`). No se inventan IDs: la regla pide al menos una transacción real de testnet con su ID o enlace a HashScan, junto con los IDs de cuenta, topic y contrato.

| Qué | ID / enlace HashScan |
|---|---|
| Cuenta del oráculo (Hedera) | `0.0.…` |
| Topic de HCS (evidencia) | `0.0.…` |
| Contrato GreenTon | `0x…` · deploy `0x…` |
| Contrato Mercado | `0x…` · deploy `0x…` |
| Alta de los predios IMPEN1, CHACO1, TACOP1 | `0x…` |
| Verificaciones (evidencia en HCS + lote en HSCS) | mensajes `#…` · `0x…` |
| TACOP1 · 2026 NDVI 0,612 → **congela** | `0x…` |
| Oferta de 3.000 t de IMPEN1 2026 | `0x…` |
| **Compra y quema atómica** de 500 t | `0x…` |

## Arquitectura

```
Sentinel-2 L2A (Planetary Computer, STAC)
        │  NDVI medio del polígono (oracle/ndvi.py → oracle/evidence/*.json)
        ▼
Oráculo ──1. mensaje de evidencia──► HCS (topic: solo escribe el oráculo)
   │                                         ▲ SHA-256 del mensaje
   └──2. submitVerification(..., evidencia)──► GreenTon (HSCS) ◄── billetera (propietario)
                                                • registerParcel (solo admin)   • retire / transfer por lote
                                                • submitVerification (solo oráculo) • unfreeze (solo admin/auditor)
                                                      ▲ transferFrom (custodia) · retire (quema)
                                                      │
                                                  Mercado (HSCS) ◄── billetera (propietario: list/cancel · empresa: buyAndRetire en HBAR)
                                                      │
                                    Web (Vite + React + ethers) lee por JSON-RPC y mirror node
```

Reglas de GreenTon (`contracts/GreenTon.sol`):
- Solo el oráculo emite, **una vez por predio y período**. Cada emisión crea un **lote** (predio, período) y guarda el hash de su evidencia en HCS.
- Saldos, transferencias y retiros son **por lote**: cada tonelada retirada apunta al predio y a la verificación de origen.
- NDVI < 0,400 **o** caída > 0,150 respecto de la línea base ⇒ el predio se **congela** y no emite lotes nuevos.
- `retire` quema, reduce el suministro y guarda quién compensó y de qué lote; `unfreeze` lo hace un admin (auditor humano).

Reglas del mercado (`contracts/Market.sol`):
- Publicar una oferta pone el lote en custodia del mercado (el propietario autoriza al mercado una vez con `setOperator`).
- `buyAndRetire` cobra el pago exacto en HBAR, paga al vendedor y a la tesorería (comisión de plataforma, tope 10 %) y quema las toneladas a nombre del beneficiario **en una sola transacción**. Si falla el pago, no se quema nada.
- Solo el vendedor cancela, y recupera el remanente.

Verificación pública: `npm run audit` baja cada mensaje de HCS del mirror node, calcula su SHA-256 y lo compara con el hash guardado en el lote.

## Cómo correrlo

Requisitos: Node 20+, y para medir NDVI de nuevo Python 3.11+. Detalle y solución de errores en [`DEPLOY.md`](DEPLOY.md).

```sh
npm install
npm test                 # 28 pruebas de GreenTon y Mercado, locales (Hardhat)

# Hedera Testnet: cuenta ECDSA en https://portal.hedera.com → .env (ver .env.example)
npm run deploy           # topic de HCS + GreenTon + Mercado + alta de predios
npm run demo             # evidencia en HCS, verificación en HSCS, oferta y compra/quema atómica
npm run audit            # contrato y evidencia coinciden

# Oráculo (mide con el satélite y publica)
python3 -m venv oracle/.venv && oracle/.venv/bin/pip install pystac-client planetary-computer rasterio numpy
oracle/.venv/bin/python oracle/run.py verify IMPEN1 202604 "2026-03-01/2026-04-30"
python3 -m unittest discover -s oracle/tests

# Web
cd web && npm install
VITE_GREENTON_ID=0x... VITE_MARKET_ID=0x... VITE_TOPIC_ID=0.0.... npm run dev
```

## Estado de lo probado

- **Probado:** las 28 pruebas de contratos (`npm test`), el tipado de los scripts (`tsc`), la compilación de la web (`npm run build`) y la lectura de los contratos con el ABI que usa la web, sobre una red local de Hardhat.
- **Sin probar contra Hedera Testnet al escribir este README:** el despliegue, la publicación en HCS, la conversión de unidades de `msg.value` (tinybars/weibars, ver `DEPLOY.md`) y el flujo con billetera. Hay que correr `npm run deploy` y `npm run demo` con una cuenta real y completar la tabla de arriba.

## Limitaciones (dichas de frente)

- **Oráculo de clave única**: centralizado en esta versión. Siguiente paso: multi-oráculo/umbral y auditores certificados.
- **Factor NDVI→tCO₂e simplificado e ilustrativo** (5,5 tCO₂e/ha/año a vigor máximo, escalado por NDVI). **No es una metodología certificada** (Verra/IPCC). El camino natural en Hedera es Sustainability Studio (Guardian).
- Los "períodos" 2019 y 2026 usan la misma estación (feb–mar) para comparar; 2019 funciona como línea base histórica, no como siete años de emisión real.
- **TACOP1 no es una tala.** Lo elegimos por su caída de NDVI, pero la cobertura del suelo (Impact Observatory) muestra que ya era ~83 % cultivos en 2017: es un **falso positivo** del NDVI por estacionalidad agrícola. Lo conservamos porque ilustra el congelamiento y la necesidad de un auditor.
- **El NDVI solo puede no detectar una tala**: una conversión de monte a cultivo medida en estación húmeda tiene NDVI alto. Cuatro bloques documentados en `docs/validacion.md`, sección 3b. La segunda señal todavía no está en el contrato.
- **Sin entrevistas a usuarios registradas todavía.** La validación es documental y técnica; el plan y la plantilla de entrevistas están en [`docs/validacion.md`](docs/validacion.md) §6.
- **Congelar no bloquea lotes viejos**: las toneladas emitidas antes de la caída se pueden seguir ofertando. La web lo advierte en la oferta.
- **GreenTon no es un token de HTS ni ERC-20**: las billeteras genéricas no muestran los saldos por lote. Un token de HTS por lote está en la hoja de ruta.
- Testnet únicamente.

## Equipo

`PENDIENTE: nombres y roles del equipo (2 a 5 integrantes)`
