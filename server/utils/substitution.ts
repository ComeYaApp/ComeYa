// Utilidades de sustitución de productos.
//
// El cliente guarda `substituteProductIds` como OBJETO
// {productIdOriginal: productIdSustituto} (CheckoutScreen hace
// JSON.stringify de un objeto). Cualquier consumidor del servidor debe
// aceptar objeto Y array para no perder los sustitutos: durante un tiempo
// el listado del negocio solo parseaba arrays y los nombres nunca se
// resolvían (el panel mostraba "Producto e2779d").

export interface SubstitutionRow {
  substitute_product_ids?: string | null;
}

/**
 * Recolecta los IDs de productos SUSTITUTOS (los valores) de una lista
 * de filas de pedidos. Tolera JSON con forma de objeto, array, basura o
 * null; nunca lanza.
 */
export function collectSubstituteIds(
  rows: readonly SubstitutionRow[],
): string[] {
  const ids = new Set<string>();
  for (const row of rows) {
    const raw = row?.substitute_product_ids;
    if (!raw) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    if (Array.isArray(parsed)) {
      parsed.forEach((id) => {
        if (id) ids.add(String(id));
      });
    } else if (parsed && typeof parsed === "object") {
      Object.values(parsed as Record<string, unknown>).forEach((id) => {
        if (id) ids.add(String(id));
      });
    }
  }
  return [...ids];
}
