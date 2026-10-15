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
  familyRenameInput,
} from "./schema";
export type { ItemFilters, ModelFilters, TrackingType } from "./schema";
export { validateStatusChange, isAvailableStatus, manualStatuses } from "./status";
export { buildTree, flattenTree, pathNames } from "./tree";
export * as inventoryActions from "./actions";
export { InventoryTabs } from "./components/inventory-tabs";
export { FamilyList } from "./components/family-list";
export { RenameFamilyDialog } from "./components/rename-family-dialog";
export { LabelsDialog } from "./components/labels-dialog";
export { CategoryColorPicker, LengthColorsToggle, LengthColorsTable } from "./components/color-controls";
export { categoryColorMap, lengthColorFor } from "./color-map";
export { renderLabels } from "./labels";
export type { LabelItem } from "./labels";
export { labelSize, isLabelSizeKey, cellFor, pageCount, perPage, pageMm } from "./label-layout";
export type { LabelSize } from "./label-layout";
export { ModelForm } from "./components/model-form";
export { ItemForm } from "./components/item-form";
export { StatusDialog, MoveDialog } from "./components/item-actions";
export { KitSection } from "./components/kit-section";
export { CategoryDialog, DeleteCategoryButton, LocationDialog, DeleteLocationButton } from "./components/tree-forms";
