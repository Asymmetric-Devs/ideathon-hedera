# 0002. Qué servicios de Hedera usa Dosel, y cuáles quedan para después

**Estado:** aceptada · octubre 2026

## Contexto

El track de Hedera pide usar uno o más servicios (HTS, HCS, HSCS, Asset Tokenization Studio, Stablecoin Studio, Guardian, Agent Kit) y que cada uno cumpla una función real. Dosel nació en Stellar con tres piezas: un contrato de lotes, un mercado con compra y quema atómica, y un oráculo que mide NDVI con Sentinel-2.

## Decisión

| Servicio | Uso en Dosel | Por qué ahí |
|---|---|---|
| **HSCS** (Solidity) | `GreenTon` (registro por lote, reglas de emisión y congelamiento, retiro) y `Market` (compra y quema atómica pagada en HBAR) | Las reglas tienen que ejecutarse sin que nadie las pueda saltear: solo el oráculo emite, una vez por predio y período, y si el NDVI cae el predio se congela. Pagar y quemar tienen que ser todo o nada. |
| **HCS** | Un topic donde el oráculo publica la evidencia de cada verificación antes de firmar en el contrato | La evidencia (escena, NDVI, polígono) es demasiado pesada y cambiante para vivir en un contrato, pero tiene que ser inalterable y tener sello de tiempo del consenso. El contrato guarda su SHA-256, así que contrato y evidencia se verifican entre sí. El `submitKey` del topic es la clave del oráculo: nadie más puede escribir. |
| **HBAR** | Medio de pago del mercado | Liquidación nativa sin intermediario ni token de pago extra. |

## Alternativas consideradas y por qué no ahora

- **Un token de HTS por lote.** Es el diseño natural a futuro (saldos visibles en cualquier billetera, asociación de tokens, KYC y freeze nativos). Exige llamar a las precompiladas de HTS desde el contrato y probarlo contra un nodo de Hedera; no se pudo validar a tiempo y preferimos entregar algo que sí probamos. Está en la hoja de ruta.
- **Sustainability Studio (Guardian).** Es el servicio pensado para créditos de carbono con metodologías auditables. Dosel hoy usa un factor NDVI→tCO₂e simplificado, que no es una metodología certificada. Pasar a Guardian implica adoptar una metodología reconocida (VCS/IPCC) con su política y sus roles; es el paso siguiente y la razón de declarar ese límite de frente.
- **Stablecoin Studio.** Pagar en una stablecoin evitaría la volatilidad del HBAR. El mercado hoy es testnet; no suma a la demostración.
- **Agent Kit.** Un agente que ejecute el oráculo es posible, pero el problema que Dosel resuelve no es la autonomía de un agente sino la prueba detrás de cada tonelada.

## Consecuencias

- El contrato, el topic y la web se verifican con herramientas públicas: HashScan y el mirror node. `npm run audit` lo hace por línea de comandos.
- El oráculo sigue siendo una sola clave (la que firma en HCS y en el contrato). Es el límite principal declarado en el README.
