import { ConsentPurpose } from '@shgap/database';

export interface PrivacyNotice {
  version: string;
  title: string;
  text: string;
}

/**
 * DPDP Act 2023 requires a clear notice to accompany (not just precede)
 * consent capture for each specific purpose — "bundled" blanket consent
 * isn't compliant. `version` is stored on every `Consent` row it's granted
 * under (already a real schema field, unused until T22), so a later notice
 * rewording never silently reinterprets what someone already agreed to —
 * their consent stays tied to the version of the text they actually saw.
 */
export const PRIVACY_NOTICES: Record<ConsentPurpose, PrivacyNotice> = {
  PRODUCT_REGISTRATION: {
    version: '2026-07-v1',
    title: 'Product & SHG registration',
    text: 'We use your SHG and product details (name, location, bank details for payouts) to list your products on the platform and match you with buyers. This data is shared with MEPMA officials for programme monitoring.',
  },
  VOICE_ASSISTANT_RECORDING: {
    version: '2026-07-v1',
    title: 'Voice assistant recording',
    text: 'If you use the voice assistant, your spoken audio is processed to understand your request (speech-to-text) and is not stored after your session ends unless you separately report an issue that requires reviewing it.',
  },
  MARKETING_NOTIFICATIONS: {
    version: '2026-07-v1',
    title: 'Marketing & opportunity notifications',
    text: 'We may send you SMS/WhatsApp/voice alerts about buyer interest, government tenders (GeM) matching your products, and platform updates. You can withdraw this consent at any time without affecting your SHG registration.',
  },
  DATA_SHARING_WITH_BUYERS: {
    version: '2026-07-v1',
    title: 'Sharing your details with buyers',
    text: 'We share your SHG name, product catalogue, and district/location with registered buyers so they can find and contact you. We do not share your bank details or phone number with buyers directly.',
  },
  ANALYTICS: {
    version: '2026-07-v1',
    title: 'Programme analytics & dashboards',
    text: 'Your sales, enquiry, and recommendation activity is aggregated (often alongside other SHGs) into district/state dashboards used by MEPMA officials to monitor and improve the programme.',
  },
};
