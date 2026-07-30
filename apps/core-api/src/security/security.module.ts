import { Global, Module } from '@nestjs/common';
import { KMS_KEY_PROVIDER } from './kms-key-provider.interface';
import { EnvKmsKeyProvider } from './providers/env-kms-key.provider';
import { PiiEncryptionService } from './pii-encryption.service';

@Global()
@Module({
  providers: [
    PiiEncryptionService,
    // No real KMS account exists for this pilot — see ADR-0031. Swapping to
    // a real KMS-backed provider is a one-line change here.
    { provide: KMS_KEY_PROVIDER, useClass: EnvKmsKeyProvider },
  ],
  exports: [PiiEncryptionService],
})
export class SecurityModule {}
