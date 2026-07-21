import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationsController } from './notifications.controller';
import {
  NOTIFICATIONS_QUEUE,
  NotificationsService,
} from './notifications.service';
import { NotificationsProcessor } from './notifications.processor';
import { ConsoleEmailProvider } from './providers/email/console-email.provider';
import { SesProvider } from './providers/email/ses.provider';
import {
  EMAIL_PROVIDER,
  SMS_PROVIDER,
  VOICE_PROVIDER,
  WHATSAPP_PROVIDER,
} from './providers/provider.tokens';
import { ConsoleSmsProvider } from './providers/sms/console-sms.provider';
import { Msg91Provider } from './providers/sms/msg91.provider';
import { ConsoleVoiceProvider } from './providers/voice/console-voice.provider';
import { ExotelProvider } from './providers/voice/exotel.provider';
import { ConsoleWhatsappProvider } from './providers/whatsapp/console-whatsapp.provider';
import { WhatsappBusinessProvider } from './providers/whatsapp/whatsapp-business.provider';
import { TemplateService } from './templates/template.service';

@Module({
  imports: [BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE })],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsProcessor,
    TemplateService,
    // Each channel binds its real provider only when the relevant
    // credentials are configured, falling back to a console/dev-stub
    // otherwise (mirrors core-api's SMS_PROVIDER/ConsoleSmsProvider pattern
    // from T05) — so this module boots and is fully exercisable without any
    // real MSG91/WhatsApp/Exotel/SES account. See ADR-0022.
    {
      provide: SMS_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.get<string>('MSG91_AUTH_KEY')
          ? new Msg91Provider(config)
          : new ConsoleSmsProvider(),
    },
    {
      provide: WHATSAPP_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.get<string>('WHATSAPP_ACCESS_TOKEN')
          ? new WhatsappBusinessProvider(config)
          : new ConsoleWhatsappProvider(),
    },
    {
      provide: VOICE_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.get<string>('EXOTEL_ACCOUNT_SID')
          ? new ExotelProvider(config)
          : new ConsoleVoiceProvider(),
    },
    {
      provide: EMAIL_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.get<string>('AWS_ACCESS_KEY_ID')
          ? new SesProvider(config)
          : new ConsoleEmailProvider(),
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
