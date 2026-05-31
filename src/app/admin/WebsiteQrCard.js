"use client";

import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

const WEBSITE_URL = "https://capriloveboat.com";

export default function WebsiteQrCard() {
  const qrCanvasRef = useRef(null);
  const [copyLinkStatus, setCopyLinkStatus] = useState("idle");
  const [copyQrStatus, setCopyQrStatus] = useState("idle");

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(WEBSITE_URL);
      setCopyLinkStatus("copied");
    } catch {
      setCopyLinkStatus("failed");
    }
  }

  async function handleCopyQr() {
    try {
      const canvas = qrCanvasRef.current;

      if (!canvas || !navigator.clipboard || typeof ClipboardItem === "undefined") {
        throw new Error("Clipboard image support unavailable.");
      }

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((nextBlob) => {
          if (nextBlob) {
            resolve(nextBlob);
            return;
          }

          reject(new Error("Could not generate QR image blob."));
        }, "image/png");
      });

      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
      setCopyQrStatus("copied");
    } catch {
      setCopyQrStatus("failed");
    }
  }

  function handleDownloadQr() {
    const canvas = qrCanvasRef.current;

    if (!canvas) {
      return;
    }

    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = "capriloveboat-com-qr.png";
    link.click();
  }

  return (
    <section className="mt-6 border border-stone-300 bg-[#fbf8f3] p-6 sm:p-8">
      <p className="text-xs uppercase tracking-[0.22em] text-stone-500">
        Permanent QR
      </p>
      <h2 className="mt-4 text-3xl font-light tracking-[-0.03em]">
        Website QR code
      </h2>
      <p className="mt-3 text-sm leading-6 text-stone-600">{WEBSITE_URL}</p>

      <div className="mt-6 inline-flex bg-white p-4">
        <QRCodeCanvas ref={qrCanvasRef} value={WEBSITE_URL} size={220} marginSize={2} />
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleCopyLink}
          className="border border-stone-950 bg-stone-950 px-5 py-3 text-xs font-medium uppercase tracking-[0.18em] text-[#f3eee7] transition hover:bg-transparent hover:text-stone-950"
        >
          {copyLinkStatus === "copied"
            ? "Link copied"
            : copyLinkStatus === "failed"
              ? "Copy failed"
              : "Copy link"}
        </button>
        <button
          type="button"
          onClick={handleCopyQr}
          className="border border-stone-300 px-5 py-3 text-xs font-medium uppercase tracking-[0.18em] text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
        >
          {copyQrStatus === "copied"
            ? "QR copied"
            : copyQrStatus === "failed"
              ? "QR copy failed"
              : "Copy QR image"}
        </button>
        <button
          type="button"
          onClick={handleDownloadQr}
          className="border border-stone-300 px-5 py-3 text-xs font-medium uppercase tracking-[0.18em] text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
        >
          Download PNG
        </button>
      </div>
    </section>
  );
}
