/* ============================================================================
 * ACTIVE DATASET — Crestline Cloud · Revenue Funnel
 * ----------------------------------------------------------------------------
 * One React context holding the record arrays every page derives from. It is
 * a SEAM, not a second data path: whatever is in here is passed straight to
 * `applyFilters` and flows through the same engine, so all reconciliation
 * invariants hold for your own records exactly as they do for the sample.
 *
 * The value is the seeded sample dataset, so a remixer who changes nothing
 * gets today's dashboard with zero configuration. To use your own data,
 * replace the `LEADS` and `DEALS` arrays in `src/lib/rf/data.ts`.
 * ==========================================================================*/

import { createContext, useContext } from "react";
import type { ReactNode } from "react";

import { SAMPLE_DATASET, type Dataset } from "./engine";

interface DatasetContextValue {
  dataset: Dataset;
}

const DatasetContext = createContext<DatasetContextValue>({ dataset: SAMPLE_DATASET });

const VALUE: DatasetContextValue = { dataset: SAMPLE_DATASET };

export function DatasetProvider({ children }: { children: ReactNode }) {
  return <DatasetContext.Provider value={VALUE}>{children}</DatasetContext.Provider>;
}

export function useDataset() {
  return useContext(DatasetContext);
}
