// Public interface of the board module: the office screen (/board).
export { boardData } from "./queries";
export type { BoardData, BoardJob } from "./queries";
export { phasesOf, phaseItems, sortAgenda, packLanes, barSpan } from "./logic";
export type { BoardPhase, AgendaItem } from "./logic";
export { BoardClock, BoardRefresh } from "./components/board-live";
export { BoardThemeToggle } from "./components/board-theme";
export { boardThemeScript, type BoardTheme } from "./theme-script";
export { LongTimeline } from "./components/long-timeline";
export { JobCard, AgendaDay } from "./components/board-sections";
