/** What a rendered template looks like for each channel — see templates/templates.ts. */
export interface SmsMessage {
  /** MSG91 DLT-registered template id — Indian telecom regulation (DLT)
   * requires SMS content to match a pre-registered template exactly, so
   * there's no freeform-text send path (see ADR-0011/ADR-0022). */
  templateId: string;
  /** Named variables substituted into the DLT template's placeholders. */
  variables: Record<string, string>;
  /** Fully-rendered text, for logging/audit and the console dev-stub —
   * not sent to MSG91 itself, which only takes `templateId` + `variables`. */
  renderedText: string;
}

export interface WhatsappMessage {
  /** Pre-approved WhatsApp Business template name (Meta requires template
   * approval for business-initiated messages, same DLT-style constraint
   * SMS has) — not freeform text. */
  templateName: string;
  languageCode: string;
  /** Positional body parameters, in template placeholder order. */
  params: string[];
}

export interface VoiceMessage {
  /** Text read aloud by the IVR call's TTS step. */
  ttsText: string;
}

export interface EmailMessage {
  subject: string;
  bodyText: string;
}

/** Result of a successful send — `providerMessageId` is persisted on the
 * `Notification` row for later delivery-status reconciliation/support lookups. */
export interface ProviderSendResult {
  providerMessageId?: string;
}

export interface SmsProvider {
  send(toPhone: string, message: SmsMessage): Promise<ProviderSendResult>;
}

export interface WhatsappProvider {
  send(toPhone: string, message: WhatsappMessage): Promise<ProviderSendResult>;
}

export interface VoiceProvider {
  send(toPhone: string, message: VoiceMessage): Promise<ProviderSendResult>;
}

export interface EmailProvider {
  send(toEmail: string, message: EmailMessage): Promise<ProviderSendResult>;
}
