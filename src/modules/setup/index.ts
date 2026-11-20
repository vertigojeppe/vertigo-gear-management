// Public interface of the setup module (how long installations take).
export { installationTypes, setupRecords, SetupError } from "./service";
export { installationTypeList, installationTypeDetail } from "./queries";
export type { InstallationTypeRow, SetupRecordRow } from "./queries";
export { ruleEstimate } from "./logic";
export { installationTypeInput, setupRecordInput } from "./schema";
