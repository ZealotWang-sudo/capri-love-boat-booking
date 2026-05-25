"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

const DEFAULT_LABELS = {
  close: "Close",
  copied: "Copied",
  copyFailed: "Copy failed",
  qrButton: "Show QR code",
  qrCopyButton: "Copy QR image",
  qrCopyCopied: "QR image copied",
  qrCopyFailed: "Could not copy QR image",
  qrDescription: "Let another group scan this QR code to open the shared boat page.",
  qrTitle: "Shared boat QR code",
};

export default function CopySharedLinkButton({ label, labels = {}, path }) {
  const [status, setStatus] = useState("idle");
  const [origin, setOrigin] = useState("");
  const [qrCopyStatus, setQrCopyStatus] = useState("idle");
  const [qrOpen, setQrOpen] = useState(false);
  const qrCanvasRef = useRef(null);
  const mergedLabels = { ...DEFAULT_LABELS, ...labels };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setOrigin(window.location.origin);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const url = origin && path ? `${origin}${path}` : path;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  async function handleCopyQrImage() {
    try {
      const canvas = qrCanvasRef.current;

      if (!canvas || !navigator.clipboard || typeof ClipboardItem === "undefined") {
        throw new Error("QR image clipboard is not available.");
      }

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((nextBlob) => {
          if (nextBlob) {
            resolve(nextBlob);
            return;
          }

          reject(new Error("Could not create QR image."));
        }, "image/png");
      });

      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
      setQrCopyStatus("copied");
    } catch {
      setQrCopyStatus("failed");
    }
  }

  return (
    <>
      <input
        readOnly
        value={url}
        className="mt-4 w-full border border-stone-300 bg-[#fbf8f3] px-4 py-3 text-sm text-stone-950 outline-none"
      />
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={handleCopy}
          className="w-full border border-stone-950 bg-stone-950 px-5 py-3 text-xs font-medium uppercase tracking-[0.18em] text-[#f3eee7] transition hover:bg-transparent hover:text-stone-950 sm:w-auto"
        >
          {status === "copied"
            ? mergedLabels.copied
            : status === "failed"
              ? mergedLabels.copyFailed
              : label}
        </button>
        <button
          type="button"
          onClick={() => {
            setQrCopyStatus("idle");
            setQrOpen(true);
          }}
          className="w-full border border-stone-300 px-5 py-3 text-xs font-medium uppercase tracking-[0.18em] text-stone-700 transition hover:border-stone-950 hover:text-stone-950 sm:w-auto"
        >
          {mergedLabels.qrButton}
        </button>
      </div>
      {qrOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/45 px-5 py-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="shared-link-qr-title"
        >
          <div className="w-full max-w-sm border border-stone-950 bg-[#fbf8f3] p-6 text-center shadow-xl">
            <h2
              id="shared-link-qr-title"
              className="text-2xl font-light tracking-[-0.03em] text-stone-950"
            >
              {mergedLabels.qrTitle}
            </h2>
            <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-stone-600">
              {mergedLabels.qrDescription}
            </p>
            <div className="mt-6 inline-flex bg-white p-4">
              <QRCodeCanvas
                ref={qrCanvasRef}
                value={url}
                size={220}
                marginSize={2}
              />
            </div>
            <button
              type="button"
              onClick={handleCopyQrImage}
              className="mt-6 w-full border border-stone-950 bg-stone-950 px-5 py-3 text-xs font-medium uppercase tracking-[0.18em] text-[#f3eee7] transition hover:bg-transparent hover:text-stone-950"
            >
              {qrCopyStatus === "copied"
                ? mergedLabels.qrCopyCopied
                : qrCopyStatus === "failed"
                  ? mergedLabels.qrCopyFailed
                  : mergedLabels.qrCopyButton}
            </button>
            <button
              type="button"
              onClick={() => setQrOpen(false)}
              className="mt-3 w-full border border-stone-300 px-5 py-3 text-xs font-medium uppercase tracking-[0.18em] text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
            >
              {mergedLabels.close}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
