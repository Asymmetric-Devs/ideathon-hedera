# 0001. Lotes por predio y período, y compra-retiro atómica

**Estado:** aceptada · octubre 2026 (decisión heredada de la versión de Stellar y adaptada a Hedera)

## Contexto

Un saldo único por cuenta pierde de dónde salió cada tonelada: la primera transferencia borra esa relación. Una oferta que dijera "200 t de El Impenetrable", o un certificado con ese predio, prometería una procedencia que el contrato no puede probar.

## Decisión

1. **GreenTon lleva saldos por lote `(predio, período)`.** `transfer`, `transferFrom` y `retire` reciben el lote. `Retirement` guarda el lote.
2. **Un contrato de mercado aparte custodia el lote desde que se publica la oferta.** En la EVM de Hedera un contrato no puede mover los lotes de otro sin permiso, así que el propietario autoriza al mercado como operador (`setOperator`, una vez) y después `list` lo mueve con `transferFrom`.
3. **`buyAndRetire` es una sola transacción.** Cobra en HBAR (`msg.value` exacto), paga al vendedor y a la tesorería, y llama a `retire` como titular del lote, a nombre del beneficiario. Si algo falla se revierte todo. No existe compra sin quema.
4. **Firma con una billetera EVM.** La plataforma no guarda claves.
5. **El congelamiento no cambia.** `unfreeze` copia el último NDVI como línea base, y los lotes ya emitidos de un predio congelado se pueden ofertar.

## Consecuencias

- El certificado de retiro apunta a un lote, y ese lote a la verificación satelital, a su escena y a su mensaje en HCS.
- GreenTon no es un token estándar (ni ERC-20 ni HTS): las billeteras genéricas no muestran saldos por lote. Ver [ADR 0002](0002-servicios-de-hedera.md).
- Quien compra en el mercado no recibe GTON, los quema. Para retener toneladas hay que operar con `transfer` fuera del mercado.
- En los retiros del mercado, el titular registrado es la dirección del mercado. El comprador queda en el `Purchase` y en el evento `Purchased`.
- Las toneladas de un predio que se congela después siguen en venta. La web lo advierte en la oferta.
