import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ProviderSendResult,
  VoiceMessage,
  VoiceProvider,
} from '../provider.interface';

/**
 * Real Exotel Voice (Connect) API integration for outbound IVR/TTS alerts.
 *
 * Exotel's Connect API triggers a call and plays a server-side "Applet"
 * (an ExoML flow) rather than accepting TTS text directly as a call
 * parameter — so the message text is passed as a query parameter to a
 * configurable applet URL (`EXOTEL_VOICE_APPLET_URL`) that, in a real
 * deployment, would be a small ExoML endpoint reading it back with a
 * `<Say>` verb. This is the most significant unverified piece of the four
 * providers: unlike MSG91/WhatsApp/SES (whose request/response contracts are
 * stable and well-documented independent of any account), Exotel's exact
 * applet-configuration step is normally done interactively in their
 * dashboard, and there was no live account to confirm this against — see
 * ADR-0022's honest accounting of what wasn't verified live.
 */
@Injectable()
export class ExotelProvider implements VoiceProvider {
  private readonly logger = new Logger(ExotelProvider.name);
  private readonly accountSid: string;
  private readonly apiKey: string;
  private readonly apiToken: string;
  private readonly callerId: string;
  private readonly voiceAppletUrl: string;

  constructor(config: ConfigService) {
    this.accountSid = config.getOrThrow<string>('EXOTEL_ACCOUNT_SID');
    this.apiKey = config.getOrThrow<string>('EXOTEL_API_KEY');
    this.apiToken = config.getOrThrow<string>('EXOTEL_API_TOKEN');
    this.callerId = config.getOrThrow<string>('EXOTEL_CALLER_ID');
    this.voiceAppletUrl = config.getOrThrow<string>('EXOTEL_VOICE_APPLET_URL');
  }

  async send(
    toPhone: string,
    message: VoiceMessage,
  ): Promise<ProviderSendResult> {
    const url = `https://api.exotel.com/v1/Accounts/${this.accountSid}/Calls/connect.json`;
    const appletUrl = `${this.voiceAppletUrl}?text=${encodeURIComponent(message.ttsText)}`;
    const basicAuth = Buffer.from(`${this.apiKey}:${this.apiToken}`).toString(
      'base64',
    );

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: `91${toPhone}`,
        CallerId: this.callerId,
        Url: appletUrl,
      }).toString(),
    });

    const body = (await response.json().catch(() => ({}))) as {
      Call?: { Sid?: string };
      RestException?: { Message?: string };
    };

    if (!response.ok || body.RestException) {
      throw new Error(
        `Exotel call failed: ${body.RestException?.Message ?? response.statusText}`,
      );
    }

    const providerMessageId = body.Call?.Sid;
    this.logger.log(
      `Exotel call initiated to ${toPhone} (sid=${providerMessageId ?? 'n/a'})`,
    );
    return { providerMessageId };
  }
}
