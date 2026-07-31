import acVentilation from "@/assets/categories/ac-ventilation.jpg.asset.json";
import bricklayer from "@/assets/categories/bricklayer.jpg.asset.json";
import carpenter from "@/assets/categories/carpenter.jpg.asset.json";
import design2d3d from "@/assets/categories/design-2d-3d.jpg";
import fullProject from "@/assets/categories/full-project.jpg";
import electrician from "@/assets/categories/electrician.jpg.asset.json";
import formwork from "@/assets/categories/formwork-2.jpg.asset.json";
import glassAluminum from "@/assets/categories/glass-aluminum-installer.jpg.asset.json";
import landscaper from "@/assets/categories/landscaper.jpg.asset.json";
import machineryOperator from "@/assets/categories/machinery-operator.jpg.asset.json";
import painter from "@/assets/categories/painter.jpg.asset.json";
import plumber from "@/assets/categories/plumber.jpg.asset.json";
import roofer from "@/assets/categories/roofer.avif.asset.json";
import signage from "@/assets/categories/signage.jpg.asset.json";
import swimmingPoolBuilder from "@/assets/categories/swimming-pool-builder.jpg.asset.json";
import tiler from "@/assets/categories/tiler.jpg.asset.json";
import welder from "@/assets/categories/welder.jpg.asset.json";

const categoryImages: Record<string, string> = {
  A1: bricklayer.url,
  A2: formwork.url,
  A3: swimmingPoolBuilder.url,
  A4: machineryOperator.url,
  B1: electrician.url,
  B2: plumber.url,
  B3: acVentilation.url,
  B4: welder.url,
  C1: painter.url,
  C2: tiler.url,
  C3: carpenter.url,
  D1: roofer.url,
  D2: landscaper.url,
  D3: glassAluminum.url,
  D5: signage.url,
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