# Por qué blockchain, y por qué Hedera

Esta es la respuesta a «¿por qué no alcanza una base de datos tradicional?». Va primero lo que falla hoy y quiénes no se fían entre sí; después qué parte del sistema necesita la cadena y cuál no.

## Quiénes participan y por qué no confían entre sí

| Parte | Qué quiere | Por qué desconfía de las otras |
|---|---|---|
| Propietario del bosque | Cobrar por conservarlo | El comprador y el intermediario pueden pagarle tarde, poco o nunca; el registro del crédito lo lleva otro |
| Empresa que compensa | Un crédito que resista una auditoría | El propietario cobra por declarar que el bosque está en pie; el operador del registro cobra por emitir |
| Operador de la plataforma (Dosel) | Comisión por compra | Tiene un incentivo a que se emita y se venda, así que su base de datos no es una prueba neutral |
| Auditor / ONG | Que la medición sea reproducible | No puede revisar una base que otro puede editar |
| Regulador | Que no haya doble conteo | En Argentina el marco legal del mercado de carbono sigue en el Congreso: no hay un registro nacional único al que todos acudan |

## Qué falla hoy sin blockchain

1. **La prueba la aporta quien cobra.** Un PDF firmado por el dueño o por el desarrollador del proyecto, medido una vez. Si el bosque cae después, el crédito sigue circulando.
2. **La tonelada se puede vender dos veces.** Con registros de operadores distintos (o de uno solo que edite su base), nada impide que la misma tonelada figure en dos compradores o que un retiro se «des-retire».
3. **Pagar y compensar son dos pasos.** El comprador paga por afuera y espera que le registren la baja. Si una parte incumple, nada lo registra ni lo revierte.
4. **El comprador no puede rastrear el origen.** No puede probar de qué predio salió la tonelada ni cuándo se midió.

## Por qué una base de datos no alcanza

Una base de datos resuelve el problema cuando existe **una parte en la que todos confían** para administrarla. Acá no existe: el operador tiene un interés económico, y el registro nacional que podría cumplir ese rol todavía no está. Lo que Dosel necesita de la cadena es una propiedad concreta: **que nadie, ni el propio operador, pueda editar el saldo, el retiro o la evidencia después de que ocurrieron, y que cualquiera lo pueda comprobar sin pedirle permiso a Dosel**. Un registro público compartido da eso; una base administrada por una de las partes, no.

Cada pieza de Dosel que va a la cadena responde a un fallo de la lista de arriba:

| Fallo | Qué lo resuelve en Hedera |
|---|---|
| Una tonelada, un solo dueño; el retiro no se deshace | Saldos por lote y quema en un contrato de HSCS: un único estado visible para todos |
| Pagar y compensar separados | `buyAndRetire`: cobra en HBAR, paga al vendedor y a la tesorería, y quema, todo o nada, en una transacción |
| La regla de emisión cambia según quién manda | Código público: solo el oráculo emite, una vez por predio y período, y el predio se congela bajo 0,40 de NDVI o con una caída mayor a 0,15 |
| La evidencia se puede reemplazar | Mensaje en HCS con sello de tiempo del consenso; el SHA-256 queda en el lote, así que contrato y evidencia se verifican entre sí (`npm run audit`) |

## Lo que no va a la cadena

Las imágenes satelitales, el cálculo del NDVI, los mapas y las noticias. Pesan, cambian y no necesitan confianza compartida: se pueden recalcular desde Sentinel-2 con el mismo código. Solo vive en la red lo que necesita que nadie lo pueda reescribir.

## Cuándo esto no haría falta

Si un regulador o un registro único de confianza administrara los créditos y todos lo aceptaran, una base de datos sería suficiente y más barata. La propuesta de Dosel depende de que ese registro hoy no exista. Y aun con ese registro, la evidencia sellada y la compra con quema atómica seguirían siendo útiles para quien no quiere depender de él.

## Por qué Hedera

- **HCS** es justo el servicio para evidencia ordenada y con sello de tiempo, sin desplegar un contrato por cada mensaje.
- **HSCS** corre Solidity y herramientas EVM conocidas (Hardhat, ethers, billeteras estándar), así que el contrato se prueba y se audita con lo que ya existe.
- **Comisiones predecibles y confirmación en segundos**, relevantes para un mercado donde cada compra paga y quema en una transacción.
- **Mirror node y HashScan** dan historial completo y consultable de logs y mensajes, sin indexador propio.
- Caminos naturales a futuro dentro del mismo ecosistema: HTS para un token por lote y Sustainability Studio (Guardian) para metodologías auditables de carbono. Ver [ADR 0002](adr/0002-servicios-de-hedera.md).
