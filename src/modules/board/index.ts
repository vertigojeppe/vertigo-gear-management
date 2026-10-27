// Public interface of the board module: the office screen (/board).
export { boardData } from "./queries";
export type { BoardData, BoardJob } from "./queries";
export { phasesOf, phaseItems, sortAgenda, packLanes, barSpan } from "./logic";
export type { BoardPhase, AgendaItem } from "./logic";
export { boardThemeScript, type BoardTheme } from "./theme-script";
