import { NotificationEvent, PreferredLanguage } from '@shgap/database';
import {
  EmailMessage,
  SmsMessage,
  VoiceMessage,
  WhatsappMessage,
} from '../providers/provider.interface';

/** Values substituted into a template — one bag of named fields per event,
 * documented at each event's dispatch call site (notifications.service.ts). */
export type TemplateContext = Record<string, string>;

const isTelugu = (lang: PreferredLanguage) => lang === PreferredLanguage.TELUGU;

/**
 * `templateKey` values below are the identifiers persisted on the
 * `Notification` row and passed to MSG91 as `template_id` — in a real
 * deployment they'd be the exact DLT-registered template IDs issued via
 * MSG91's portal (or a lookup table mapping these keys to them). No live
 * MSG91 account was available to register real templates against in this
 * task (see ADR-0022), so these are stable, descriptive placeholders.
 */
export const SMS_TEMPLATES: Partial<
  Record<
    NotificationEvent,
    {
      templateKey: string;
      render: (ctx: TemplateContext, lang: PreferredLanguage) => SmsMessage;
    }
  >
> = {
  [NotificationEvent.OTP]: {
    templateKey: 'OTP_LOGIN_V1',
    render: (ctx, lang) => ({
      templateId: 'OTP_LOGIN_V1',
      variables: { OTP: ctx.otp, MINUTES: ctx.expiresInMinutes },
      renderedText: isTelugu(lang)
        ? `మీ SHGAP OTP: ${ctx.otp}. ఇది ${ctx.expiresInMinutes} నిమిషాలు మాత్రమే చెల్లుతుంది. దీన్ని ఎవరితోనూ పంచుకోవద్దు.`
        : `Your SHGAP OTP is ${ctx.otp}. Valid for ${ctx.expiresInMinutes} minutes. Do not share this with anyone.`,
    }),
  },
  [NotificationEvent.BUYER_ENQUIRY]: {
    templateKey: 'BUYER_ENQUIRY_V1',
    render: (ctx, lang) => ({
      templateId: 'BUYER_ENQUIRY_V1',
      variables: { BUYER: ctx.buyerName, PRODUCT: ctx.productName },
      renderedText: isTelugu(lang)
        ? `${ctx.buyerName} మీ ఉత్పత్తి "${ctx.productName}" గురించి ఆసక్తి చూపారు. SHGAP యాప్‌లో చూడండి.`
        : `${ctx.buyerName} enquired about your product "${ctx.productName}". Check the SHGAP app for details.`,
    }),
  },
};

export const WHATSAPP_TEMPLATES: Partial<
  Record<
    NotificationEvent,
    {
      templateKey: string;
      render: (
        ctx: TemplateContext,
        lang: PreferredLanguage,
      ) => WhatsappMessage;
    }
  >
> = {
  [NotificationEvent.BUYER_ENQUIRY]: {
    templateKey: 'buyer_enquiry_v1',
    render: (ctx, lang) => ({
      templateName: 'buyer_enquiry_v1',
      languageCode: isTelugu(lang) ? 'te' : 'en',
      params: [ctx.buyerName, ctx.productName],
    }),
  },
  [NotificationEvent.DEMAND_INCREASE]: {
    templateKey: 'demand_increase_v1',
    render: (ctx, lang) => ({
      templateName: 'demand_increase_v1',
      languageCode: isTelugu(lang) ? 'te' : 'en',
      params: [ctx.productName, ctx.districtName ?? ''],
    }),
  },
  [NotificationEvent.PRICE_CHANGE]: {
    templateKey: 'price_change_v1',
    render: (ctx, lang) => ({
      templateName: 'price_change_v1',
      languageCode: isTelugu(lang) ? 'te' : 'en',
      params: [ctx.productName, ctx.newPrice],
    }),
  },
  [NotificationEvent.TENDER_OPPORTUNITY]: {
    templateKey: 'tender_opportunity_v1',
    render: (ctx, lang) => ({
      templateName: 'tender_opportunity_v1',
      languageCode: isTelugu(lang) ? 'te' : 'en',
      params: [ctx.tenderTitle, ctx.deadline ?? ''],
    }),
  },
};

export const VOICE_TEMPLATES: Partial<
  Record<
    NotificationEvent,
    {
      templateKey: string;
      render: (ctx: TemplateContext, lang: PreferredLanguage) => VoiceMessage;
    }
  >
> = {
  [NotificationEvent.TENDER_OPPORTUNITY]: {
    templateKey: 'tender_opportunity_voice_v1',
    render: (ctx, lang) => ({
      ttsText: isTelugu(lang)
        ? `కొత్త టెండర్ అవకాశం: ${ctx.tenderTitle}. వివరాల కోసం SHGAP యాప్ చూడండి.`
        : `New tender opportunity: ${ctx.tenderTitle}. Check the SHGAP app for details.`,
    }),
  },
};

export const EMAIL_TEMPLATES: Partial<
  Record<
    NotificationEvent,
    {
      templateKey: string;
      render: (ctx: TemplateContext, lang: PreferredLanguage) => EmailMessage;
    }
  >
> = {
  [NotificationEvent.DEMAND_INCREASE]: {
    templateKey: 'demand_increase_email_v1',
    render: (ctx, lang) => ({
      subject: isTelugu(lang) ? 'డిమాండ్ పెరిగింది' : 'Demand increase alert',
      bodyText: isTelugu(lang)
        ? `${ctx.productName} కోసం డిమాండ్ పెరిగింది${ctx.districtName ? ` (${ctx.districtName})` : ''}. SHGAP యాప్‌లో వివరాలు చూడండి.`
        : `Demand for ${ctx.productName} has increased${ctx.districtName ? ` in ${ctx.districtName}` : ''}. See the SHGAP app for details.`,
    }),
  },
  [NotificationEvent.PRICE_CHANGE]: {
    templateKey: 'price_change_email_v1',
    render: (ctx, lang) => ({
      subject: isTelugu(lang) ? 'ధర మార్పు హెచ్చరిక' : 'Price change alert',
      bodyText: isTelugu(lang)
        ? `${ctx.productName} ధర ఇప్పుడు ${ctx.newPrice}.`
        : `The price of ${ctx.productName} is now ${ctx.newPrice}.`,
    }),
  },
  [NotificationEvent.TENDER_OPPORTUNITY]: {
    templateKey: 'tender_opportunity_email_v1',
    render: (ctx, lang) => ({
      subject: isTelugu(lang)
        ? 'కొత్త టెండర్ అవకాశం'
        : 'New tender opportunity',
      bodyText: isTelugu(lang)
        ? `${ctx.tenderTitle}${ctx.deadline ? ` — గడువు: ${ctx.deadline}` : ''}. వివరాల కోసం SHGAP యాప్ చూడండి.`
        : `${ctx.tenderTitle}${ctx.deadline ? ` — deadline: ${ctx.deadline}` : ''}. See the SHGAP app for details.`,
    }),
  },
};
