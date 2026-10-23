// Public interface of the settings module: admin-defined custom fields
// (and later webhooks, label settings).
export { customFieldDefinitions, webhooks, outboxAdmin, SettingsError } from "./service";
export { customFieldDefinitionInput, webhookInput, type CustomFieldDefinitionInput, type WebhookInput } from "./schema";
export { createCustomField, updateCustomField, deleteCustomField, saveWebhook, deleteWebhook, retryOutboxRow, saveGlossary, saveLayout } from "./actions";
export { glossary } from "./glossary";
export { appSettings } from "./app-settings";
