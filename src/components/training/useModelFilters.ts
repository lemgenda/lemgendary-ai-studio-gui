/**
 * LemGendary AI Studio - search and filter state for the model catalog.
 */

import { useMemo, useState } from "react";
import { ModelItem } from "../../api/types";

export function useModelFilters(models: ModelItem[]) {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [archFilter, setArchFilter] = useState<string>("ALL");

  // Derived filter options
  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    models.forEach((m) => {
      if (m.category) cats.add(m.category);
    });
    return Array.from(cats).sort();
  }, [models]);

  const uniqueArchitectures = useMemo(() => {
    const archCounts: Record<string, number> = {};
    models.forEach((m) => {
      const arch = m.architecture || "Unknown";
      archCounts[arch] = (archCounts[arch] || 0) + 1;
    });
    return Object.entries(archCounts)
      .map(([arch, count]) => ({ arch, count }))
      .sort((a, b) => b.count - a.count);
  }, [models]);

  // Filtered models
  const filteredModels = useMemo(() => {
    return models.filter((m) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = m.display_name.toLowerCase().includes(q) || m.key.toLowerCase().includes(q);
        const matchesArch = m.architecture.toLowerCase().includes(q);
        const matchesCat = (m.category || "").toLowerCase().includes(q);
        const matchesTask = (m.task_type || "").toLowerCase().includes(q);
        if (!matchesName && !matchesArch && !matchesCat && !matchesTask) return false;
      }
      if (statusFilter !== "ALL") {
        // Filter on the Training Suite verdict only (no epoch or checkpoint heuristics).
        if (m.training_status.toUpperCase() !== statusFilter) return false;
      }
      if (categoryFilter !== "ALL" && m.category !== categoryFilter) return false;
      if (archFilter !== "ALL" && m.architecture !== archFilter) return false;
      return true;
    });
  }, [models, searchQuery, statusFilter, categoryFilter, archFilter]);

  return {
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    categoryFilter,
    setCategoryFilter,
    archFilter,
    setArchFilter,
    uniqueCategories,
    uniqueArchitectures,
    filteredModels,
  };
}
