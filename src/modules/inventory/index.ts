// Public interface of the inventory module.
export { categories, locations, models, items, InventoryError, redactFinance, actorCanSeeFinance } from "./service";
export type { ModelDto, ItemDto, Link } from "./service";
export {
  categoryOptions,
  categoryTree,
  locationOptions,
  locationList,
  modelOptions,
  listModels,
  modelDetail,
  listItems,
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
} from "./schema";
export type { ItemFilters, ModelFilters, TrackingType } from "./schema";
export { validateStatusChange, isAvailableStatus, manualStatuses } from "./status";
export { buildTree, flattenTree, pathNames } from "./tree";
export * as inventoryActions from "./actions";
export { InventoryTabs } from "./components/inventory-tabs";
export { ModelForm } from "./components/model-form";
export { ItemForm } from "./components/item-form";
export { StatusDialog, MoveDialog } from "./components/item-actions";
export { KitSection } from "./components/kit-section";
export { CategoryDialog, DeleteCategoryButton, LocationDialog, DeleteLocationButton } from "./components/tree-forms";
