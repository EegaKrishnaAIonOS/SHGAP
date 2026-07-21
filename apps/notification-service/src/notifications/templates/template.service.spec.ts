import {
  NotificationChannel,
  NotificationEvent,
  PreferredLanguage,
} from '@shgap/database';
import { TemplateNotFoundError, TemplateService } from './template.service';

describe('TemplateService', () => {
  let service: TemplateService;

  beforeEach(() => {
    service = new TemplateService();
  });

  describe('templateKeyFor', () => {
    it('returns the registered template key for a known (event, channel) pair', () => {
      expect(
        service.templateKeyFor(NotificationEvent.OTP, NotificationChannel.SMS),
      ).toBe('OTP_LOGIN_V1');
    });

    it('throws TemplateNotFoundError for a pair with no template', () => {
      expect(() =>
        service.templateKeyFor(
          NotificationEvent.OTP,
          NotificationChannel.VOICE,
        ),
      ).toThrow(TemplateNotFoundError);
    });
  });

  describe('render', () => {
    it('renders an SMS OTP message in English by default variables', () => {
      const message = service.render(
        NotificationEvent.OTP,
        NotificationChannel.SMS,
        { otp: '123456', expiresInMinutes: '10' },
        PreferredLanguage.ENGLISH,
      );
      expect(message).toEqual({
        templateId: 'OTP_LOGIN_V1',
        variables: { OTP: '123456', MINUTES: '10' },
        renderedText:
          'Your SHGAP OTP is 123456. Valid for 10 minutes. Do not share this with anyone.',
      });
    });

    it('renders the Telugu variant when the user prefers Telugu', () => {
      const message = service.render(
        NotificationEvent.OTP,
        NotificationChannel.SMS,
        { otp: '654321', expiresInMinutes: '5' },
        PreferredLanguage.TELUGU,
      );
      expect((message as { renderedText: string }).renderedText).toContain(
        '654321',
      );
      expect((message as { renderedText: string }).renderedText).toContain(
        'SHGAP OTP',
      );
    });

    it('renders a WhatsApp template with positional params', () => {
      const message = service.render(
        NotificationEvent.BUYER_ENQUIRY,
        NotificationChannel.WHATSAPP,
        { buyerName: 'ABC Retailers', productName: 'Mango Pickle' },
        PreferredLanguage.ENGLISH,
      );
      expect(message).toEqual({
        templateName: 'buyer_enquiry_v1',
        languageCode: 'en',
        params: ['ABC Retailers', 'Mango Pickle'],
      });
    });

    it('renders an email message with subject and body', () => {
      const message = service.render(
        NotificationEvent.PRICE_CHANGE,
        NotificationChannel.EMAIL,
        { productName: 'Turmeric Powder', newPrice: 'Rs 150/kg' },
        PreferredLanguage.ENGLISH,
      );
      expect(message).toEqual({
        subject: 'Price change alert',
        bodyText: 'The price of Turmeric Powder is now Rs 150/kg.',
      });
    });

    it('throws TemplateNotFoundError when rendering an unregistered pair', () => {
      expect(() =>
        service.render(
          NotificationEvent.OTP,
          NotificationChannel.EMAIL,
          {},
          PreferredLanguage.ENGLISH,
        ),
      ).toThrow(TemplateNotFoundError);
    });
  });
});
