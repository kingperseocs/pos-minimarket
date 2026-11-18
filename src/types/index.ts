import type { CaptureSource } from "@/domain/value-objects/capture-source";

export type CartItem = {
  productId: number;
  name: string;
  unitPrice: number;
  quantity: number;
  // One unit is the worker's birthday gift.
  isGift: boolean;
  // Scanned with the reader, or picked on screen (any tap makes it manual).
  captureSource: CaptureSource;
};
