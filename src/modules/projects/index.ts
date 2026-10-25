// Public interface of the projects module: clients, projects, crew,
// contacts and the availability engine shared with rentals and the calendar.
export { clients, projects, allocations, allocationsFor, itemsForModel, modelAvailability, deriveWindow, ProjectError, ConflictError } from "./service";
export { linksToText, parseLinks } from "./schema";
export type { ProjectDto, Link as ProjectLink } from "./service";
export { computeAvailability, checkRequest, unitDoubleBookings, overbookedDays } from "./availability";
export type { Availability, AllocationLike, ItemLike, Window } from "./availability";
export { clientOptions, crewOptions, listProjects, projectDetail, modelAvailabilityView, timeline, timelineBars, upcomingProjects } from "./queries";
export type { ProjectListRow, ReservationRow, TimelineBar } from "./queries";
export { clientInput, projectInput, projectStatusInput, contactInput, crewInput, allocationInput, projectFilters, availabilityQuery, PROJECT_STATUS_KEYS } from "./schema";
export type { ProjectInput, ClientInput, AllocationInput, ProjectFilters } from "./schema";
export * as projectActions from "./actions";
export { ProjectForm } from "./components/project-form";
export { ClientDialog, DeleteClientButton } from "./components/client-dialog";
export { ReserveDialog } from "./components/reserve-dialog";
export type { ReservationEdit } from "./components/reserve-dialog";
export { CrewDialog, ContactDialog, RemoveCrewButton, RemoveContactButton } from "./components/crew-contact-dialogs";
export { ProjectStatusButtons, DeleteProjectButton, RemoveReservationButton } from "./components/project-buttons";
export { Timeline, BAR_COLORS, barColor } from "./components/timeline";
