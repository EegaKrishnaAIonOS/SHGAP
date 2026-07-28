import { Module } from '@nestjs/common';
import { MEPMA_SYNC_PROVIDER } from './mepma-sync-provider.interface';
import { SimulatedMepmaSyncProvider } from './providers/simulated-mepma-sync.provider';
import { MepmaSyncService } from './mepma-sync.service';
import { MepmaSyncSchedulerService } from './mepma-sync-scheduler.service';
import { MepmaSyncController } from './mepma-sync.controller';

@Module({
  controllers: [MepmaSyncController],
  providers: [
    MepmaSyncService,
    MepmaSyncSchedulerService,
    // No live MEPMA API access exists for this pilot — see ADR-0030.
    // Swapping to a real HTTP-calling provider later is a one-line change
    // here, nothing else in this module needs to know.
    { provide: MEPMA_SYNC_PROVIDER, useClass: SimulatedMepmaSyncProvider },
  ],
})
export class MepmaModule {}
