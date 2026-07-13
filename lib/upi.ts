import QRCode from "qrcode";

/** Basic shape check for a UPI VPA, e.g. "teacher@okhdfcbank". Not exhaustive. */
export function isValidUpiId(upiId: string): boolean {
  return /^[\w.+-]{2,256}@[a-zA-Z][\w.-]{1,64}$/.test(upiId);
}

export function buildUpiUri(opts: {
  payeeUpiId: string;
  payeeName: string;
  /** Rupees (not paise). Strings are coerced: pg returns NUMERIC columns as strings. */
  amount?: number | string | null;
  note?: string;
}): string {
  const amount = opts.amount == null ? null : Number(opts.amount);
  // Build the UPI deep-link manually.
  //
  // Why NOT URLSearchParams.toString():
  //   • It encodes spaces as '+' (application/x-www-form-urlencoded) which many
  //     UPI apps reject — we need '%20'.
  //   • It encodes '@' in the payee VPA (pa=) as '%40', which all major UPI apps
  //     (GPay, PhonePe, Paytm, BHIM) reject — they require the literal '@'.
  //
  // We therefore build each segment manually using encodeURIComponent for
  // text fields (which always produces '%20' for spaces, not '+') and pass
  // the VPA (payeeUpiId) as-is because a validated VPA only contains safe
  // ASCII characters: [a-z0-9.+-] before the '@' and [a-z0-9.-] after it.
  const parts: string[] = [
    `pa=${opts.payeeUpiId}`,                        // VPA: do NOT encode '@'
    `pn=${encodeURIComponent(opts.payeeName)}`,     // payee name: spaces → %20
    `cu=INR`,
  ];
  if (amount != null && Number.isFinite(amount) && amount > 0) {
    parts.push(`am=${amount.toFixed(2)}`);
  }
  if (opts.note)   parts.push(`tn=${encodeURIComponent(opts.note)}`);

  return `upi://pay?${parts.join("&")}`;
}

export async function buildUpiQrDataUrl(upiUri: string): Promise<string> {
  return QRCode.toDataURL(upiUri, { margin: 1, width: 240 });
}
