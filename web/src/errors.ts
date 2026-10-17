export type ErrorContext = "greenton" | "market";

const MARKET: Record<string, string> = {
  InvalidAmount: "La cantidad tiene que ser mayor que cero.",
  InvalidPrice: "El precio tiene que ser mayor que cero.",
  OfferNotFound: "Esa oferta no existe.",
  OfferClosed: "La oferta ya está cerrada: se vendió entera o la canceló su dueño.",
  AmountExceedsAvailable: "La oferta no tiene tantas toneladas disponibles. Alguien pudo comprar antes que vos.",
  NotSeller: "Solo quien publicó la oferta puede cancelarla.",
  WrongPayment: "El pago no coincide con el precio de la oferta. Recargá la página y probá de nuevo.",
  PaymentFailed: "El vendedor no pudo recibir el pago, así que no se cobró ni se quemó nada.",
  // Errores de GreenTon que pueden aparecer al publicar una oferta.
  InsufficientBalance: "El saldo de ese lote no alcanza.",
  NotAuthorized: "Primero tenés que autorizar al mercado a custodiar tus lotes.",
};
const GREENTON: Record<string, string> = {
  ParcelExists: "Ese predio ya está registrado.",
  ParcelNotFound: "Ese predio no está registrado.",
  ParcelFrozen: "El predio está congelado.",
  PeriodAlreadyIssued: "Ese período ya se emitió para el predio.",
  InvalidAmount: "La cantidad tiene que ser mayor que cero.",
  InsufficientBalance: "El saldo de ese lote no alcanza.",
  NotFrozen: "El predio no está congelado.",
};

/** Traduce los errores de la red y de la billetera a una explicación que se pueda actuar. */
export function explainError(e: unknown, ctx?: ErrorContext): string {
  const raw = e instanceof Error ? e.message : String(e);
  const code = (e as { code?: string | number }).code;
  if (code === 4001 || code === "ACTION_REJECTED" || /declin|reject|denied|cancel|user closed/i.test(raw)) {
    return "Cancelaste la firma en tu billetera. No se cobró nada y no cambió nada en la red.";
  }
  const name = raw.match(/^contract:(\w+)/)?.[1];
  if (name) {
    const msg = (ctx === "greenton" ? GREENTON : MARKET)[name] ?? MARKET[name] ?? GREENTON[name];
    if (msg) return msg;
  }
  if (/insufficient funds|insufficient.*balance|INSUFFICIENT_PAYER_BALANCE|INSUFFICIENT_TX_FEE/i.test(raw)) {
    return "Tu cuenta no tiene saldo suficiente de HBAR para este pago y su comisión de red. Podés cargar HBAR de prueba desde el faucet de Hedera.";
  }
  if (/timeout/i.test(raw)) {
    return "La red tardó demasiado en confirmar. Revisá en HashScan si la operación salió antes de reintentar.";
  }
  if (/fetch|network ?error|failed to fetch|could not detect network|SERVER_ERROR/i.test(raw)) {
    return "No pudimos comunicarnos con la red de Hedera. Revisá tu conexión y probá de nuevo.";
  }
  return raw.length > 220 ? `${raw.slice(0, 220)}…` : raw;
}
