"use client";

import { useEffect, useState } from "react";

/**
 * Payment actions under the UPI QR code. Copying the UPI ID is the reliable
 * manual path alongside scanning the QR code.
 */
export function UpiPayActions({ upiId }: { upiId: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

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
      <button type="button" className="btn-secondary" onClick={copy}>
        {copied ? "✓ Copied" : "Copy UPI ID"}
      </button>
    </div>
  );
}
