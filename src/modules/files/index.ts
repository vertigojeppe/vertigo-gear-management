// Public interface of the files module.
export { files, FileError } from "./service";
export type { AttachmentDto } from "./service";
export { uploadAttachment, deleteAttachment } from "./actions";
export { uploads, deleteFileIfUnused } from "./uploads";
export { AttachmentsSection } from "./components/attachments";
