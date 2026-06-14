import acVentilation from "@/assets/categories/ac-ventilation.jpg.asset.json";
import bricklayer from "@/assets/categories/bricklayer.jpg.asset.json";
import carpenter from "@/assets/categories/carpenter.jpg.asset.json";
import electrician from "@/assets/categories/electrician.jpg.asset.json";
import formwork from "@/assets/categories/formwork.jpg.asset.json";
import glassAluminum from "@/assets/categories/glass-aluminum-installer.jpg.asset.json";
import landscaper from "@/assets/categories/landscaper.jpg.asset.json";
import machineryOperator from "@/assets/categories/machinery-operator.jpg.asset.json";
import painter from "@/assets/categories/painter.jpg.asset.json";

const categoryImages: Record<string, string> = {
  A1: bricklayer.url,
  A2: formwork.url,
  A4: machineryOperator.url,
  B1: electrician.url,
  B3: acVentilation.url,
  C1: painter.url,
  C3: carpenter.url,
  D2: landscaper.url,
  D3: glassAluminum.url,
};

export function CategoryImage({ code, name }: { code: string; name: string }) {
  const src = categoryImages[code];
  if (!src) return null;

  return (
    <img
      src={src}
      alt={name}
      loading="lazy"
      className="h-full w-full object-cover"
    />
  );
}