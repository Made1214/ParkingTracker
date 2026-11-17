import type {
  EstablishmentType,
  ItemTaxCategory,
  TaxProfile,
  TaxSuggestion,
} from "./types";

/**
 * Perfil de Panamá (ITBMS, Código Fiscal art. 1057-V). Revisado el
 * 2026-11-16; ver docs/receipts/DECISIONS.md §Impuestos.
 *
 * Lo que está claro en la fuente oficial (DGI):
 *  - Tarifa general: 7 %.
 *  - Tarifa del 10 % para determinadas operaciones con bebidas alcohólicas.
 *  - Exento: expendio de alimentos en locales donde NO se venden ni consumen
 *    bebidas alcohólicas.
 *
 * Lo que NO está claro: si el alcohol SERVIDO en un restaurante o bar lleva
 * 10 % o 7 %. Hay fuentes que defienden ambas lecturas, por eso esa
 * combinación siempre pide confirmación y nunca se impone.
 */

const GENERAL = { id: "pa_itbms_7", label: "ITBMS 7 %", rateBp: 700 };
const ALCOHOL = { id: "pa_itbms_10", label: "ITBMS 10 %", rateBp: 1000 };
const TOBACCO = { id: "pa_itbms_15", label: "ITBMS 15 %", rateBp: 1500 };

const exempt = (ruleId: string, note: string, needsConfirmation = false) =>
  ({ rateId: null, rateBp: 0, ruleId, needsConfirmation, note }) as const;

function suggest(
  establishment: EstablishmentType,
  category: ItemTaxCategory,
): TaxSuggestion {
  if (category === "tobacco")
    return {
      rateId: TOBACCO.id,
      rateBp: TOBACCO.rateBp,
      ruleId: "pa.tobacco",
      needsConfirmation: true,
      note: "Productos de tabaco: tarifa especial. Confirma con la factura.",
    };

  if (establishment === "restaurant_without_alcohol" && category !== "service")
    return exempt(
      "pa.food_service_no_alcohol",
      "Expendio de alimentos en local sin venta ni consumo de alcohol: exento. Confirma que la factura no cobra ITBMS.",
      true,
    );

  if (category === "alcoholic_beverage") {
    if (establishment === "supermarket" || establishment === "other")
      return {
        rateId: ALCOHOL.id,
        rateBp: ALCOHOL.rateBp,
        ruleId: "pa.alcohol_retail",
        needsConfirmation: false,
        note: "Venta de bebidas alcohólicas: 10 %.",
      };
    return {
      rateId: ALCOHOL.id,
      rateBp: ALCOHOL.rateBp,
      ruleId: "pa.alcohol_served",
      needsConfirmation: true,
      note: "Alcohol servido en restaurante o bar: hay interpretaciones de 7 % y de 10 %. Usa lo que imprime la factura.",
    };
  }

  if (
    (category === "groceries_basic" || category === "medicine") &&
    (establishment === "supermarket" || establishment === "pharmacy")
  )
    return exempt(
      "pa.basic_goods",
      "Alimentos básicos y medicamentos suelen estar exentos. Confirma con la factura.",
      true,
    );

  return {
    rateId: GENERAL.id,
    rateBp: GENERAL.rateBp,
    ruleId: "pa.general",
    needsConfirmation: establishment === "other",
    note: "Tarifa general del ITBMS.",
  };
}

export const panamaTaxProfile: TaxProfile = {
  jurisdiction: "PA",
  currency: "PAB",
  rates: [GENERAL, ALCOHOL, TOBACCO],
  reviewedOn: "2026-11-16",
  sources: [
    {
      title: "DGI — ITBMS, generalidades",
      url: "https://dgi.mef.gob.pa/itbms/Generalidades",
    },
    {
      title: "DGI — Servicios exentos de ITBMS (art. 1057-V)",
      url: "https://dgi.mef.gob.pa/itbms/SE-Itbms",
    },
    {
      title: "DGI — Instructivo ITBMS 2023",
      url: "https://dgi.mef.gob.pa/DInforme/pdf/Instructivo-ITBMS-2023-V6-(002).pdf",
    },
  ],
  suggest,
};
