/**
 * Perfiles tributarios por jurisdicción. Las reglas solo SUGIEREN y VALIDAN:
 * el reparto usa siempre los impuestos impresos en la factura. Si una regla
 * no es concluyente, `needsConfirmation` obliga a que la persona confirme.
 */

export type EstablishmentType =
  | "restaurant_with_alcohol"
  | "restaurant_without_alcohol"
  | "bar"
  | "supermarket"
  | "pharmacy"
  | "other";

export type ItemTaxCategory =
  | "food"
  | "non_alcoholic_beverage"
  | "alcoholic_beverage"
  | "tobacco"
  | "groceries_basic"
  | "medicine"
  | "service"
  | "other";

export type TaxRate = {
  id: string;
  label: string;
  /** Puntos básicos: 700 = 7 %. */
  rateBp: number;
};

export type TaxSuggestion = {
  /** null = exento / sin impuesto esperado. */
  rateId: string | null;
  rateBp: number;
  ruleId: string;
  needsConfirmation: boolean;
  note: string;
};

export type TaxSource = { title: string; url: string };

export type TaxProfile = {
  jurisdiction: string;
  currency: string;
  rates: readonly TaxRate[];
  sources: readonly TaxSource[];
  /** Fecha en que se revisaron las fuentes (ISO). */
  reviewedOn: string;
  suggest(
    establishment: EstablishmentType,
    category: ItemTaxCategory,
  ): TaxSuggestion;
};
