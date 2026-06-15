import { createClientOnlyFn } from "@tanstack/react-start";

const MAX_EDGE = 1600;

export const prepareImageForRecognition = createClientOnlyFn(
  async (file: File): Promise<string> => {
    const source = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(source.width, source.height));
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      source.close();
      throw new Error("Image processing is unavailable");
    }
    context.drawImage(source, 0, 0, width, height);
    source.close();
    return canvas.toDataURL("image/jpeg", 0.82);
  },
);
