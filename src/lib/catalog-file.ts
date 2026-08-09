import { prepareImageForRecognition } from "@/lib/image-resize";

export interface CatalogImportPayload {
  storeId: string;
  imageDataUrl?: string;
  fileDataUrl?: string;
  fileName?: string;
  text?: string;
}

const MAX_DATA_URL = 7_000_000;

function readDataUrl(file: File | Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the file"));
    reader.readAsDataURL(file);
  });
}

function isSpreadsheet(file: File) {
  return /\.(xlsx|xlsm|xls|ods|csv|tsv)$/i.test(file.name);
}

/** Convert any supported price-list file into a payload the AI importer understands. */
export async function buildCatalogImportPayload(
  storeId: string,
  file: File,
): Promise<CatalogImportPayload> {
  const payload: CatalogImportPayload = { storeId };
  const isImage = file.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);

  if (isSpreadsheet(file)) {
    const XLSX = await import("xlsx");
    const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const text = book.SheetNames.map((name) => {
      const sheet = book.Sheets[name];
      return `SHEET: ${name}\n${XLSX.utils.sheet_to_csv(sheet)}`;
    })
      .join("\n\n")
      .trim();
    if (!text) throw new Error("The spreadsheet has no readable rows");
    payload.text = text.slice(0, 18_000);
    return payload;
  }

  if (isImage) {
    try {
      payload.imageDataUrl = await prepareImageForRecognition(file);
    } catch {
      // HEIC or unusual formats can fail to decode in canvas — send the original bytes.
      const raw = await readDataUrl(file);
      if (raw.length > MAX_DATA_URL) {
        throw new Error("This photo is too large. Please take a smaller photo or a screenshot.");
      }
      payload.imageDataUrl = raw;
    }
    return payload;
  }

  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    const dataUrl = await readDataUrl(file);
    if (dataUrl.length > MAX_DATA_URL) {
      throw new Error("This PDF is too large (max ~5 MB). Please split it or send a screenshot.");
    }
    payload.fileDataUrl = dataUrl;
    payload.fileName = file.name;
    return payload;
  }

  const text = (await file.text()).trim();
  if (!text) throw new Error("This file has no readable text");
  payload.text = text.slice(0, 18_000);
  return payload;
}
