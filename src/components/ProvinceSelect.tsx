import { useI18n } from "@/lib/i18n";
import { MapPin } from "lucide-react";

export const CAMBODIA_PROVINCES: { en: string; km: string }[] = [
  { en: "Phnom Penh", km: "ភ្នំពេញ" },
  { en: "Banteay Meanchey", km: "បន្ទាយមានជ័យ" },
  { en: "Battambang", km: "បាត់ដំបង" },
  { en: "Kampong Cham", km: "កំពង់ចាម" },
  { en: "Kampong Chhnang", km: "កំពង់ឆ្នាំង" },
  { en: "Kampong Speu", km: "កំពង់ស្ពឺ" },
  { en: "Kampong Thom", km: "កំពង់ធំ" },
  { en: "Kampot", km: "កំពត" },
  { en: "Kandal", km: "កណ្ដាល" },
  { en: "Koh Kong", km: "កោះកុង" },
  { en: "Kratié", km: "ក្រចេះ" },
  { en: "Mondulkiri", km: "មណ្ឌលគិរី" },
  { en: "Oddar Meanchey", km: "ឧត្ដរមានជ័យ" },
  { en: "Pailin", km: "ប៉ៃលិន" },
  { en: "Preah Sihanouk", km: "ព្រះសីហនុ" },
  { en: "Preah Vihear", km: "ព្រះវិហារ" },
  { en: "Prey Veng", km: "ព្រៃវែង" },
  { en: "Pursat", km: "ពោធិ៍សាត់" },
  { en: "Ratanakiri", km: "រតនគិរី" },
  { en: "Siem Reap", km: "សៀមរាប" },
  { en: "Stung Treng", km: "ស្ទឹងត្រែង" },
  { en: "Svay Rieng", km: "ស្វាយរៀង" },
  { en: "Takéo", km: "តាកែវ" },
  { en: "Tboung Khmum", km: "ត្បូងឃ្មុំ" },
  { en: "Kep", km: "កែប" },
];

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  accentClass?: string;
}

export function ProvinceSelect({ value, onChange, placeholder, accentClass = "focus-within:border-primary" }: Props) {
  const { lang, t } = useI18n();
  return (
    <div className={`flex h-11 items-center overflow-hidden rounded-lg border border-border bg-background ${accentClass}`}>
      <MapPin className="ml-2 h-4 w-4 text-destructive" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-full flex-1 bg-transparent px-2 text-sm outline-none ${value ? "text-foreground" : "text-muted-foreground"}`}
      >
        <option value="">{placeholder ?? t("location_ph")}</option>
        {CAMBODIA_PROVINCES.map((p) => (
          <option key={p.en} value={p.en}>
            {lang === "km" ? p.km : p.en}
          </option>
        ))}
      </select>
    </div>
  );
}
