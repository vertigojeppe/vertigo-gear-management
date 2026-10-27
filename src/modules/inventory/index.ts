// Public interface of the inventory module.
export { categories, locations, models, items, lengthColors, modelUsage, InventoryError, redactFinance, actorCanSeeFinance } from "./service";
export type { ModelUsage, BulkResult } from "./service";
export type { ModelDto, ItemDto, Link } from "./service";
export {
  categoryOptions,
  categoryTree,
  loadColorMaps,
  lengthColorRows,
  locationOptions,
  locationList,
  modelOptions,
  listModels,
  modelDetail,
  listItems, itemsForLabels,
  itemDetail,
  kitCandidates,
  familyState,
  dashboardStats,
} from "./queries";
export type { ModelFamily, ModelListRow, ItemListRow } from "./queries";
export {
  itemFilters,
  modelFilters,
  TRACKING_TYPES,
  linksToText,
  categoryInput,
  locationInput,
  modelInput,
  itemInput,
  itemBatchInput,
  statusChangeInput,
  moveInput,
  familyEditInput,
} from "./schema";
export type { ItemFilters, ModelFilters, TrackingType } from "./schema";
export { validateStatusChange, isAvailableStatus, manualStatuses } from "./status";
export { buildTree, flattenTree, pathNames } from "./tree";
export * as inventoryActions from "./actions";
export type { TrackingPlan } from "./tracking-change";
export { categoryColorMap, lengthColorFor } from "./color-map";
export { consumables, partFits, ConsumableError, consumableDetail, sparePartsFor, lowStock, stockByModel } from "./consumables";
export type { MovementRow, LowStockRow } from "./consumables";
export { formatQty, isMetres, isLow, sparesFor, suggestSpares, CONSUMABLE_UNITS } from "./consumables-logic";
export type { ConsumableUnit, Suggestion } from "./consumables-logic";
export { renderLabels } from "./labels";
export type { LabelItem } from "./labels";
export { labelSize, isLabelSizeKey, cellFor, pageCount, perPage, pageMm } from "./label-layout";
export type { LabelSize } from "./label-layout";
export { MODEL_SORTS, ITEM_SORTS, type ModelSort, type ItemSort } from "./sorting";
