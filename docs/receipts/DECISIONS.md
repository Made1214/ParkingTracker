# Escáner de facturas y división de gastos — decisiones y progreso

Documento vivo para continuar entre sesiones. Última actualización: 2026-11-16.

## Alcance confirmado

Funcionalidad de **Parking Tracker** (salidas en grupo), dentro de la pestaña
**Gastos** de cada salida. Las personas sin cuenta participan como
**invitados** de la salida. Solo herramientas **gratuitas**.

## Arquitectura

```
src/features/receipts/
  lib/          núcleo puro y probado (sin I/O)
    money.ts        centavos enteros, reparto por resto mayor (BigInt), lectura de importes
    engine.ts       computeReceipt: artículos → descuentos → impuestos → propina/cargos
    settlement.ts   pagos, reembolsos, netos, transferencias mínimas, vista personal
    ledger.ts       factura → gastos (uno por pagador) con partes de miembros e invitados
    document.ts     esquema zod del borrador (se valida en cada guardado)
    snapshot.ts     resultado congelado al finalizar (copia personalizada)
    ocr-parse.ts    líneas OCR → artículos, impuestos, propina, total (determinista)
    review.ts       productos repetidos, huella de factura duplicada
    tax-rules/      perfil fiscal de Panamá, parametrizado por jurisdicción
  ocr/recognize.ts  Tesseract.js en el navegador + preprocesado de imagen
  api/              queries, server actions, ruta de imagen privada
  components/       flujo por pasos, resumen personalizado, sección en Gastos
```

### Integración con Gastos (decisión clave)

Al **finalizar**, la factura se convierte en gastos normales (`expenses`),
**uno por pagador**, enlazados por `expenses.receipt_id`. Así los saldos,
deudas mínimas y «Marcar saldado» existentes funcionan sin cambios.

- `ledger.ts` reparte cada pago entre consumidores para que **Σ partes de
  cada gasto = lo pagado** y **Σ partes de cada persona = su consumo**, al
  centavo. Cada pagador cubre primero su propio consumo (no crea deuda).
- **Invitados**: tabla `event_guests` (por salida) y
  `expense_guest_shares`. Le deben directamente a quien pagó; se muestran en
  «Invitados por cobrar» y el pagador (o un admin) marca «Ya me pagó». No
  entran en `get_event_balances` (que es entre miembros), por diseño.
- Solo **miembros** registran pagos (un invitado no tiene cuenta).
- Una factura **finalizada es inmutable**. «Corregir factura» la reabre:
  borra sus gastos (solo si nadie marcó un pago como saldado) y vuelve a
  borrador; al finalizar de nuevo se recrean.

### Garantías en la base de datos (`20261117003047_receipts_and_guests.sql`)

| Regla | Mecanismo |
| --- | --- |
| Partes de miembros + invitados = monto del gasto | `check_expense_total` (diferido) ampliado |
| Gastos de una factura finalizada = su total impreso | trigger diferido `check_receipt_expenses` |
| Un borrador no tiene gastos; no se borra a mano un gasto de factura | mismo trigger + FK `restrict` |
| Borrador con bloqueo optimista | `version` debe subir de 1 en 1 (`40001` si no) |
| Invitado de la misma salida que el gasto | `guard_expense_guest_share` |
| Foto solo bajo `receipts/<grupo>/<salida>/` | `CHECK receipts_image_scope` |
| Aislamiento por grupo | RLS + `FORCE RLS` + FKs compuestas con índice |
| Partes de invitados: solo se edita `settled` | permisos por columna |

Pruebas: `supabase/tests/034_receipts_and_guests.sql` (24 aserciones).

## Política monetaria y de redondeo

- Importes en centavos enteros; productos intermedios en `BigInt`.
- Reparto por **resto mayor**: `floor(total·peso/Σ)`, los centavos sobrantes
  van a la mayor fracción; empate → orden de participantes. Determinista.
- Orden: artículo neto → descuentos globales (proporcionales) → cada línea de
  impuesto impresa sobre su base → propina/cargos/ajustes.
- Cierre bloqueado si hay precio/impuesto/total ilegible, artículo sin
  asignar, impuesto sin base, diferencia con el total impreso o pagos que no
  suman. La diferencia se resuelve corrigiendo o con un **ajuste explícito**.
- Propina **sugerida** nunca suma.
- El servidor **recalcula** todo al finalizar; no confía en totales del cliente.

## Impuestos (Panamá)

Fuentes (revisadas 2026-11-16): [DGI — ITBMS](https://dgi.mef.gob.pa/itbms/Generalidades),
[DGI — exentos](https://dgi.mef.gob.pa/itbms/SE-Itbms),
[Instructivo ITBMS 2023](<https://dgi.mef.gob.pa/DInforme/pdf/Instructivo-ITBMS-2023-V6-(002).pdf>).

- Claro: 7 % general; 10 % en ciertas operaciones con alcohol; exento el
  expendio de alimentos en locales sin venta ni consumo de alcohol.
- No concluyente: 7 % o 10 % al alcohol **servido** en restaurante/bar → la
  regla pide confirmación.
- **Se reparte lo impreso.** El perfil solo sugiere y avisa; el lector propone
  la base (alcohol → tasa mayor) y pide confirmarla.

## OCR (gratuito y privado)

- **Tesseract.js 7** (Apache-2.0) en el navegador. La foto **no sale del
  dispositivo para leerla**; solo se descargan una vez el motor y el modelo
  `spa+eng` desde jsDelivr (CSP actualizada).
- Preprocesado: orientación EXIF, reducción a 2400 px, grises y estiramiento
  de contraste. HEIC funciona donde el navegador lo decodifica (Safari/iOS).
- La foto se guarda en **Cloudinary privado** (ya contratado) y se sirve por
  `/api/.../receipts/:id/image`, que revalida membresía; URL firmada de 60 s.
- Cada línea conserva su región normalizada (0..1) para resaltar lo de cada
  persona. Si la confianza de la línea es baja, no se resalta (solo lista).
- Verificado con OCR real en una factura sintética inclinada y otra degradada
  (borrosa, sombra, sin «%»): ambas concilian al centavo.

## UX

Escanear → Revisar → Personas → Asignar → Pagos → Confirmar → resumen.
Autoguardado en serie con versión, totales por persona siempre visibles,
indicador de conciliación, chips de colores para asignar con un toque,
«Todos», «Dividir distinto» (unidades, %, importe), filtro de pendientes,
aviso de baja confianza y de repetidos, confirmación antes de corregir una
factura liquidada, «Imprimir o guardar PDF» con estilos de impresión.

## Estado

| Fase | Estado |
| --- | --- |
| Motor, impuestos, propinas, pagos, netos | Hecho y probado |
| Migración + RLS + pgTAP | Hecho; verificado en Postgres 16 local y aplicado en Staging (17 nov 2026, advisors sin hallazgos nuevos). **Pendiente en Producción** |
| OCR + parser + revisión | Hecho |
| UI móvil y escritorio | Hecho; revisada con capturas en Chromium |
| Integración en Gastos e invitados | Hecho |
| Copia personalizada + resaltado + PDF | Hecho (vía imprimir) |

## Limitaciones y siguientes pasos

- No probado contra Supabase real (sin Docker aquí): falta una prueba E2E
  del flujo con la foto,.
- Reparto de propina por importes personalizados: el motor lo soporta, la UI
  solo ofrece proporcional o partes iguales.
- PDF de facturas como entrada no soportado (solo imágenes).
- Enlaces públicos para invitados sin cuenta: no implementados (requieren
  token con caducidad y revocación). Hoy se comparte el PDF.
- Reembolsos parciales: los gastos usan el «saldado» existente (todo o nada
  por pareja); `settlement.ts` ya soporta parciales para una futura UI.
- Un invitado no puede figurar como pagador.
