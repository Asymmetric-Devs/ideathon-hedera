# Evidencia de validación del problema

> **Transparencia:** la evidencia de este documento es **investigación documental de fuentes públicas** (ONG, prensa,
> legislativo) más una **validación técnica con datos reales** (Sentinel-2) sobre predios del Gran Chaco. **Todavía no hay
> entrevistas con usuarios registradas**: la sección 6 es el plan y la plantilla para hacerlas, y se completa solo con
> conversaciones que ocurrieron. Los datos citados de Greenpeace son estimaciones de esa ONG, no cifras oficiales del
> Estado; verificarlos con la Dirección de Bosques de la Nación antes de usarlos en un contexto formal.

## 1. El problema existe y es grande

| Dato | Fuente |
|---|---|
| En 2024 se desmontaron ~119.886 ha de bosque nativo en el norte (Santiago del Estero 54.123, Chaco 39.182, Formosa 15.069, Salta 11.512). En Chaco, todo lo desmontado en 2024 fue ilegal (desmontes suspendidos por la justicia desde el 16/10/2020). | [Informe de deforestación 2024, Greenpeace](https://www.greenpeace.org/static/planet4-argentina-stateless/2025/01/96e4c507-informedeforestacion-greenpeace-1.pdf) |
| En 2025: 94.204 ha desmontadas + 116.498 ha quemadas = 210.702 ha perdidas. Entre 1998 y 2024 se perdieron más de 7 millones de ha; ~75% en cuatro provincias del norte. | [Informe anual 2025, Greenpeace](https://www.greenpeace.org/static/planet4-argentina-stateless/2026/02/b30fdf7a-informeanualdeforestacionfinal-gp2025.pdf) |
| Greenpeace documentó (agosto 2025) desmontes ilegales en cuatro estancias cerca de Taco Pozo, el Parque Nacional Copo y la Reserva Loro Hablador; ~167.684 ha deforestadas ilegalmente entre nov-2020 y jul-2025 en Chaco. | [Greenpeace Argentina](https://www.greenpeace.org/argentina/story/problemas/bosques/greenpeace-documento-desmontes-ilegales-en-chaco-170-mil-hectareas-deforestadas-desde-la-suspension-judicial/) |

## 2. El mercado de carbono argentino está sin marco y sin confianza verificable

- El marco regulatorio del mercado de carbono **sigue en el Congreso**: el Senado emitió dictamen favorable (2 de septiembre de 2026) sobre un texto unificado basado en la iniciativa de la senadora Flavia Royón (S-808/26) y el S-865/26; aún falta el recinto. Fuente: [El Economista](https://eleconomista.com.ar/energia/mercados-carbono-argentina-desafio-convertir-potencial-inversion-n98080).
- El registro vigente (ReNaMi) tenía **59 proyectos** en 2023: 46 MDL, 12 VCS, 1 GSGG. Misma fuente.
- Un trabajo académico de la UNNE señala un **vacío legal** y propone usar estándares internacionales hasta que existan guías propias: [Valoración de los servicios ecosistémicos de los bosques nativos de Argentina (UNNE)](https://repositorio.unne.edu.ar/items/6efff6c0-ee8a-4186-a882-de1a23947968).
- Misiones busca financiar su estrategia REDD+ con créditos y dice estar en contacto con 25 mil pequeños propietarios de bosque nativo; hay un conflicto abierto sobre a quién pertenecen los bonos (productor o provincia): [Bichos de Campo](https://bichosdecampo.com/a-quien-pertenecen-los-bonos-de-carbono-al-productor-dueno-del-bosque-protegido-o-a-la-provincia-donde-se-situa-se-abre-otro-frente-de-conflicto-contra-los-politicos-que-intentan-recauda/).
- Riesgo de créditos sin respaldo: en Brasil, Verra suspendió proyectos ligados a una investigación de la Policía Federal por acaparamiento de tierras y lavado de madera ilegal (caso Carbonext). **No se encontró evidencia de un caso equivalente en Argentina**; se cita solo como antecedente regional del riesgo.

## 3. Validación técnica con datos reales (reproducible)

El oráculo (`oracle/`) calculó NDVI real de Sentinel-2 L2A sobre tres predios. Cada medición queda en `oracle/evidence/*.json` y, al verificarla, en HCS y en el contrato de Hedera:

| Predio | NDVI 2019 (base) | NDVI 2026 | Resultado esperado por la regla del contrato |
|---|---|---|---|
| IMPEN1 (Impenetrable) | 0,768 | 0,769 | emite en ambos períodos |
| CHACO1 (P.N. Chaco) | 0,771 | 0,773 | emite en ambos períodos |
| TACOP1 (lote agrícola en la zona Taco Pozo/Copo) | 0,814 | 0,612 | **congelado**, sin emisión |

Las mediciones de Sentinel-2 son reales y se hicieron antes, en la primera versión del proyecto (Stellar); las transacciones en Hedera Testnet que las registran están en el README (sección «Datos on-chain») una vez corrida la demo.

### 3b. Cruce con una fuente independiente (y lo que reveló)

`oracle/crosscheck.py` compara el NDVI con la cobertura anual del suelo a 10 m de Impact Observatory (`io-lulc-annual-v02`, Planetary Computer, 2017–2023). Es otra fuente, otro método y otra institución. Resultado, fracción del polígono clasificada como árboles:

| Predio | 2017 | 2019 | 2023 | Lectura |
|---|---|---|---|---|
| IMPEN1 | 96 % | 95 % | 94 % | bosque estable, coincide con el NDVI |
| CHACO1 | 60 % | 62 % | 61 % | estable (resto: pastizal), coincide con el NDVI |
| TACOP1 | 17 % | 18 % | 18 % | **ya era 83 % cultivos en 2017 y no cambió** |

**TACOP1 no es una tala.** Es tierra agrícola: la caída de NDVI de 0,814 a 0,612 es estacionalidad del cultivo (dos fechas distintas del ciclo), no pérdida de bosque. El contrato hizo lo que dice su regla (NDVI cayó más de 0,15, se congela), pero la regla dio un **falso positivo** para lo que queremos proteger. La web lo muestra: junto a cada predio hay un panel de cobertura que marca la discrepancia y pide revisión humana, que es el rol del `unfreeze` del auditor.

**El caso contrario también existe (falso negativo).** Buscamos bloques de ~900 ha con bosque casi pleno en 2017 y casi sin árboles en 2023 según la cobertura (zona Taco Pozo–Copo). En los que revisamos, el NDVI de febrero–marzo de 2026 no cayó, y en tres de cuatro incluso subió:

| Bloque (lon/lat mínimos y máximos) | Árboles 2017 → 2023 | NDVI 2019 → 2026 |
|---|---|---|
| −61,578 −25,593 / −61,548 −25,566 | 100 % → 21 % | 0,754 → 0,797 |
| −61,602 −26,135 / −61,571 −26,108 | 95 % → 14 % | 0,790 → 0,837 |
| −61,645 −25,837 / −61,615 −25,810 | 88 % → 8 % | 0,748 → 0,870 |
| −62,322 −26,095 / −62,292 −26,068 | 96 % → 15 % | 0,759 → 0,673 (−0,085, bajo el umbral de 0,15) |

Un cultivo verde en plena estación húmeda tiene NDVI alto. **Con NDVI solo, una conversión de monte a cultivo puede pasar sin congelar.** Estos bloques no se registraron en el contrato; se documentan como el límite real de la señal.

Consecuencia de diseño, todavía no implementada en el contrato: usar la cobertura del suelo como segunda señal del oráculo (congelar o alertar si los árboles caen, aunque el NDVI no baje) y exigir revisión humana cuando las dos señales discrepen.

Durante el desarrollo se detectó y corrigió un error real: sin aplicar el offset de reflectancia (−0,1) de las escenas de baseline ≥ 04.00, el NDVI de 2026 salía artificialmente ~0,3 más bajo que el de 2019 incluso en un parque nacional.

## 4. Lo que falta validar (honestidad)

- Una segunda señal de pérdida de bosque dentro del contrato (hoy solo el NDVI decide el congelamiento).
- Cobertura del suelo más reciente que 2023 para los períodos nuevos.
- Entrevistas con propietarios, ONG/INTA y empresas compradoras (ver sección 6).
- Que el factor NDVI→tCO₂e (simplificado) se reemplace por una metodología reconocida (p. ej. VCS/IPCC).
- Que un auditor humano real participe del ciclo (`unfreeze` está pensado para eso).

## 5. Antecedente

La primera versión de Dosel (Stellar Testnet, mismo hackathon) tuvo una prueba técnica de uso con una cuenta distinta de las de desarrollo y una revisión técnica externa, cuyas observaciones ya están incorporadas (comisión visible antes de firmar, enlace al certificado en «Mi cuenta»). Es historia de otra red: **no cuenta como evidencia de validación del problema** ni de la versión de Hedera.

## 6. Entrevistas con usuarios (pendiente: completar solo con conversaciones reales)

Quién tiene el problema, a quién hay que preguntarle y qué preguntarle. Cada fila se llena con fecha, quién (rol, no hace falta nombre) y qué dijo textualmente. Si no hubo conversación, queda en blanco.

| Perfil | Por qué importa | Qué preguntar | Fecha | Qué dijo |
|---|---|---|---|---|
| Propietario de bosque nativo (productor chaqueño o de Misiones) | Es quien emite y cobra | ¿Conoce los créditos de carbono? ¿Alguien le ofreció uno? ¿Cuánto tardó y cuánto le cobraron los intermediarios? ¿Qué le haría confiar en un registro público? | | |
| Originador, consultor o ONG ambiental (INTA, fundaciones) | Hoy hace el alta y la verificación a mano | ¿Cuánto cuesta y cuánto tarda verificar un predio? ¿Qué pasa si el bosque cae después de emitir? | | |
| Empresa que compensa huella (sostenibilidad, compras) | Es quien paga | ¿A quién le compra créditos hoy? ¿Cómo comprueba que no hay doble conteo? ¿Qué certificado le piden sus auditores? | | |
| Auditor o verificador | Es quien levanta el congelamiento | ¿Qué evidencia necesita para confiar en una medición satelital? | | |

Lo que hay que sacar de cada conversación: **cuánto le cuesta hoy el problema** (plata, tiempo o riesgo), **qué hace hoy en su lugar** y **qué dato o prueba le haría cambiar**. Con tres o cuatro conversaciones reales de este tipo, esta sección pasa de plan a evidencia.
