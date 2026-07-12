import QRCode from "qrcode";

/** Basic shape check for a UPI VPA, e.g. "teacher@okhdfcbank". Not exhaustive. */
export function isValidUpiId(upiId: string): boolean {
  return /^[\w.+-]{2,256}@[a-zA-Z][\w.-]{1,64}$/.test(upiId);
}

export function buildUpiUri(opts: {
  payeeUpiId: string;
  payeeName: string;
  amount?: number | null;
  note?: string;
}): string {
  const params = new URLSearchParams();
  params.set("pa", opts.payeeUpiId);
  params.set("pn", opts.payeeName);
  params.set("cu", "INR");
  if (opts.amount) params.set("am", opts.amount.toFixed(2));
  if (opts.note) params.set("tn", opts.note);
  return `upi://pay?${params.toString().replace(/\+/g, "%20")}`;
}

export async function buildUpiQrDataUrl(upiUri: string): Promise<string> {
  return QRCode.toDataURL(upiUri, { margin: 1, width: 240 });
}
