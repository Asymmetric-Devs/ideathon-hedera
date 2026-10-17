# Dosel (CarbonTrack NEA)

Plataforma de emisión, verificación satelital y retiro de créditos de carbono de bosque nativo chaqueño sobre Hedera (Smart Contract Service + Consensus Service).

## Language

**Predio**:
Unidad territorial delimitada por un polígono geográfico GPS registrada por un propietario para la conservación de bosque nativo.  
_Avoid_: Campo, finca, terreno, parcela catastral. No usar "lote" para el territorio: un **Lote** es otra cosa.

**Lote**:
Las toneladas de GreenTon emitidas para un **Predio** en un período, identificadas por el par (predio, período). Saldos, ofertas y retiros son siempre de un lote, así que cada tonelada se puede rastrear hasta la verificación satelital que la originó.  
_Avoid_: Partida, batch, emisión (la emisión es el acto; el lote es lo emitido)

**Línea Base**:
Medición inicial de vigor vegetal calculada en la primera verificación histórica del predio, usada para detectar caídas anómalas.  
_Avoid_: Benchmark, referencia, baseline histórica

**NDVI (Normalized Difference Vegetation Index)**:
Índice espectral derivado de reflectancias roja e infrarroja cercana de satélite Sentinel-2 que cuantifica la salud de la cubierta arbórea.  
_Avoid_: Índice verde, índice de biomasa

**GreenTon (GTON)**:
Crédito registrado por lote en un contrato de Hedera Smart Contract Service, equivalente exactamente a 1 tonelada de CO₂ equivalente capturada o protegida de deforestación. Siempre pertenece a un **Lote**.  
_Avoid_: Carbon credit, coin, bono de carbono

**Congelamiento**:
Estado de un predio que bloquea la emisión de lotes nuevos ante una caída de vegetación. Solo el admin (auditor humano) lo levanta con `unfreeze`, y al hacerlo la línea base pasa al último NDVI medido. No afecta a los lotes ya emitidos, que se pueden ofertar y retirar.  
_Avoid_: Pausa, suspensión, bloqueo preventivo

**Oferta**:
Publicación en el mercado de una cantidad de un **Lote** a un precio fijo por tonelada. Desde que se publica, esas toneladas quedan en custodia del contrato de mercado hasta que se compran o el vendedor cancela.  
_Avoid_: Listado, orden, venta

**Retiro**:
Quema irreversible de tokens GTON de un lote en el contrato inteligente para certificar la compensación de huella de carbono de un beneficiario. Comprar en el mercado es retirar: la compra y la quema ocurren en la misma transacción.  
_Avoid_: Burn, destrucción, canje

**Oráculo**:
Agente automatizado que procesa telemetría satelital y publica la evidencia de cada verificación en Hedera Consensus Service y firma la verificación en el contrato GreenTon.  
_Avoid_: Bot, scraper, validador off-chain

**Evidencia (HCS)**:
Mensaje que el **Oráculo** publica en un topic de Hedera Consensus Service antes de firmar una verificación: predio, período, NDVI, escena Sentinel-2, polígono y toneladas propuestas. El SHA-256 de ese mensaje queda guardado en el **Lote**, así cualquiera puede comprobar de qué evidencia salió.  
_Avoid_: Log, registro off-chain, metadata
