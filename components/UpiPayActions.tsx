"use client";

import { useEffect, useState } from "react";

async function qrFileFromDataUrl(qrDataUrl: string): Promise<File> {
  const blob = await (await fetch(qrDataUrl)).blob();
  return new File([blob], "upi-payment-qr.png", { type: blob.type || "image/png" });
}

/**
 * Payment actions under the UPI QR code.
 *
 * "Pay via UPI" shares the QR image through the native share sheet
 * (Web Share API Level 2), so the user can hand it straight to GPay/PhonePe,
 * which scan the QR from the image. This is more reliable than a upi://
 * deep link, which desktop browsers can't handle and mobile UPI apps often
 * reject for personal (non-merchant) VPAs. Copying the UPI ID remains as
 * the universal manual path.
 */
export function UpiPayActions({
  upiId,
  qrDataUrl,
  shareText,
}: {
  upiId: string;
  qrDataUrl: string;
  shareText: string;
}) {
  // File-sharing support must be probed after mount — the server can't know
  // the browser's capabilities, and rendering the button conditionally on
  // the server would cause a hydration mismatch.
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    qrFileFromDataUrl(qrDataUrl).then((file) => {
      if (cancelled) return;
      if (navigator.canShare?.({ files: [file] })) setQrFile(file);
    });
    return () => {
      cancelled = true;
    };
  }, [qrDataUrl]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const share = async () => {
    if (!qrFile) return;
    try {
      await navigator.share({ files: [qrFile], text: shareText });
    } catch {
      // User dismissed the share sheet, or the target app refused the file —
      // the QR stays visible above, so there's nothing to recover from.
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(upiId);
      setCopied(true);
    } catch {
      // Clipboard API unavailable (e.g. non-HTTPS) — leave the ID visible
      // below so the user can select it manually.
    }
  };

  return (
    <div className="mt-3 flex flex-wrap justify-center gap-2">
      {qrFile && (
        <button type="button" className="btn" onClick={share}>
          Pay via UPI
        </button>
      )}
      <button type="button" className="btn-secondary" onClick={copy}>
        {copied ? "✓ Copied" : "Copy UPI ID"}
      </button>
    </div>
  );
}
