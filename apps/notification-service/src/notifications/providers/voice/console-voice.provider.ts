import { Injectable, Logger } from '@nestjs/common';
import {
  ProviderSendResult,
  VoiceMessage,
  VoiceProvider,
} from '../provider.interface';

/** Development/POC stand-in for Exotel IVR/TTS voice calls — see
 * `console-sms.provider.ts` for the pattern this mirrors. */
@Injectable()
export class ConsoleVoiceProvider implements VoiceProvider {
  private readonly logger = new Logger(ConsoleVoiceProvider.name);

  async send(
    toPhone: string,
    message: VoiceMessage,
  ): Promise<ProviderSendResult> {
    this.logger.log(
      `[DEV VOICE STUB] calling ${toPhone}, TTS: "${message.ttsText}"`,
    );
    return { providerMessageId: `console-voice-${Date.now()}` };
  }
}
