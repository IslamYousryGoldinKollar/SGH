"use client";

import { QRCodeSVG } from "qrcode.react";

/** A QR code that stays scannable from across a lawn: navy on white, error-correction M, quiet zone included. */
export default function QRBox({ value, size = 512 }: { value: string; size?: number }) {
  if (!value) return null;
  return (
    <QRCodeSVG
      value={value}
      size={size}
      level="M"
      includeMargin={false}
      bgColor="#FFFFFF"
      fgColor="#181F4B"
      role="img"
      aria-label="QR code to open the Culture Capsule on your phone"
    />
  );
}
