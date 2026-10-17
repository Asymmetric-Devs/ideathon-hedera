# Guion del video (Hedera)

La voz real del equipo se reutilizó en las escenas cuyo texto no menciona la otra red. Las otras cuatro usan voz sintética (`es-AR-TomasNeural`) porque el audio grabado decía «Soroban», «Freighter», «Stellar Expert», «Stellar Testnet» y «500 toneladas», y en este video sería falso.

| Escena | Voz | Archivo |
|---|---|---|
| 01 Problema | Equipo (grabación original) | `assets/voiceover/team/vo-01.mp3` |
| 02 Solución | Equipo | `team/vo-02.mp3` |
| 03 Predios | Equipo | `team/vo-03.mp3` |
| 04 Congelamiento | **Sintética: regrabar** | `tts/vo-04.mp3` |
| 05 Mercado | **Sintética: regrabar** | `tts/vo-05.mp3` |
| 06 Certificado | **Sintética: regrabar** | `tts/vo-06.mp3` |
| 07 Modelo de negocio | Equipo | `team/vo-07.mp3` |
| 08 Cierre | **Sintética: regrabar** | `tts/vo-08.mp3` |

## Texto para regrabar (escenas 04, 05, 06 y 08)

### Escena 04
> ¿Y si la vegetación cae? En Taco Pozo el NDVI bajó de cero coma ocho uno a cero coma seis uno, y el contrato congeló el predio solo: cero tokens. Además cruzamos el NDVI con la cobertura del suelo a diez metros, y así descubrimos que ese predio ya era agrícola. Por eso un auditor humano decide si se descongela.

### Escena 05
> En el Mercado, una empresa elige un lote y hace clic en Comprar y quemar. Firma con su billetera, y en una sola transacción paga en HBAR al dueño del campo y retira cien toneladas a su nombre. Si algo falla, no se cobra ni se quema nada.

### Escena 06
> Cada retiro tiene su certificado con código QR. Muestra el lote, la escena satelital y el mensaje de evidencia en Hedera Consensus Service, cuyo hash está guardado en el contrato. Cualquiera lo verifica en HashScan sin confiar en Dosel.

### Escena 08
> En Dosel no comprás una promesa: financiás a quien protege el monte nativo, con un satélite que lo demuestra. Los contratos y el topic están en Hedera Testnet, con sus transacciones públicas. Probalo.

## Cómo reemplazar la voz sintética

1. Grabá cada escena y guardala como `assets/voiceover/tts/vo-04.mp3`, `vo-05.mp3`, `vo-06.mp3` y `vo-08.mp3` (si cambia la duración, las escenas se reajustan).
2. Pedile a Claude Code que rehaga los tiempos, o ajustá a mano `data-start`/`data-duration` en `index.html` y `compositions/captions.html`.
3. `npx hyperframes@0.8.167 render --output ../../docs/pitch/dosel-hedera-pitch.mp4`
