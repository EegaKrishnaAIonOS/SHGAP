import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BuyersModule } from './buyers/buyers.module';
import { CategorizationModule } from './categorization/categorization.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { IdentityThrottlerGuard } from './common/guards/identity-throttler.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AccessLogMiddleware } from './common/middleware/access-log.middleware';
import { validate } from './config/env.validation';
import { ConsentModule } from './consent/consent.module';
import { GeoModule } from './geo/geo.module';
import { HealthController } from './health.controller';
import { MasterDataModule } from './master-data/master-data.module';
import { MepmaModule } from './mepma/mepma.module';
import { OndcModule } from './ondc/ondc.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { RedisModule } from './redis/redis.module';
import { SecurityModule } from './security/security.module';
import { ShgsModule } from './shgs/shgs.module';
import { StorageModule } from './storage/storage.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    ScheduleModule.forRoot(),
    // Global anti-abuse ceiling (T22/ADR-0031, keying fixed in T23/ADR-0032)
    // — separate from, and on top of, OTP's own purpose-built per-phone-
    // number rate limit (OtpService); this one caps raw request volume
    // across every endpoint, keyed per authenticated user where possible
    // (see IdentityThrottlerGuard) and by IP only for unauthenticated routes.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    // IdentityThrottlerGuard decodes the bearer token itself to key by user
    // id — a separate registration from AuthModule's own JwtModule since
    // that one isn't exported (see ADR-0032).
    JwtModule.register({}),
    PrismaModule,
    RedisModule,
    StorageModule,
    GeoModule,
    SecurityModule,
    AuditModule,
    AuthModule,
    ConsentModule,
    UsersModule,
    ShgsModule,
    ProductsModule,
    BuyersModule,
    RecommendationsModule,
    MasterDataModule,
    CategorizationModule,
    AdminModule,
    AnalyticsModule,
    MepmaModule,
    OndcModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // IdentityThrottlerGuard runs first (as ThrottlerGuard did before it) so
    // raw request volume is capped regardless of auth outcome; it decodes
    // the bearer token itself to key by user id instead of waiting for
    // JwtAuthGuard (see ADR-0032).
    { provide: APP_GUARD, useClass: IdentityThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AccessLogMiddleware).forRoutes('*');
  }
}
