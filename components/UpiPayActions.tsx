"use client";

import { useEffect, useState } from "react";

/**
 * Payment actions under the UPI QR code.
 *
 * The `upi://pay` deep link is best-effort only: desktop browsers have no
 * handler for the scheme (clicking is a silent no-op), and even on mobile,
 * GPay/PhonePe often reject intent links to personal (non-merchant) VPAs.
 * So the link is rendered only on Android/iOS, and copying the UPI ID is
 * offered everywhere as the reliable manual path.
 */
export function UpiPayActions({ upiUri, upiId }: { upiUri: string; upiId: string }) {
  // UA sniffing must wait for mount — rendering it server-side would cause a
  // hydration mismatch (the server can't know the device).
  const [isMobile, setIsMobile] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setIsMobile(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
  }, []);

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
      {isMobile && (
        <a href={upiUri} className="btn inline-flex justify-center">
          Pay with UPI app
        </a>
      )}
    </div>
  );
}
