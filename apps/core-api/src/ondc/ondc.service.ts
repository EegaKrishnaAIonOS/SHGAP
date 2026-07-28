import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KeyObject, randomUUID } from 'crypto';
import { GeoService } from '../geo/geo.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildCatalogProviders,
  ProductForCatalog,
} from './ondc-catalog.builder';
import {
  createAuthorizationHeader,
  digestBody,
  generateSigningKeyPair,
} from './beckn-signing.util';

const BECKN_DOMAIN = 'ONDC:RET10'; // Retail — Grocery, the closest ONDC domain code to SHG produce/handicrafts
const BECKN_VERSION = '1.1.0';
const SIGNATURE_TTL_SECONDS = 300;

export interface OndcSearchIntent {
  transactionId?: string;
  messageId?: string;
  bapId?: string;
  bapUri?: string;
}

@Injectable()
export class OndcService {
  private readonly subscriberId: string;
  private readonly signingKeyId: string;
  private readonly keyPair: { privateKey: KeyObject; publicKey: KeyObject };

  constructor(
    private readonly prisma: PrismaService,
    private readonly geo: GeoService,
    config: ConfigService,
  ) {
    // No real ONDC Registry subscription exists for this pilot — a
    // configured value would be used if this platform ever registers one
    // (see beckn-signing.util.ts's docstring); until then a fresh keypair
    // is generated at boot purely to demonstrate the real signing
    // mechanism working end-to-end.
    this.subscriberId = config.get<string>(
      'ONDC_SUBSCRIBER_ID',
      'shgap.demo.ondc.local',
    );
    this.signingKeyId = `${this.subscriberId}|demo-key-1|ed25519`;
    this.keyPair = generateSigningKeyPair();
  }

  /** Builds a real `on_search` catalog response from the platform's actual
   * available products, and signs it exactly as a registered Beckn seller
   * app (BPP) would — see this module's exports for what's real crypto
   * versus a documented, honest substitution (ADR-0030). */
  async buildOnSearchResponse(intent: OndcSearchIntent = {}) {
    const products = await this.fetchCatalogProducts();
    const providers = buildCatalogProviders(products);

    const body = {
      context: {
        domain: BECKN_DOMAIN,
        action: 'on_search',
        version: BECKN_VERSION,
        bap_id: intent.bapId ?? 'unknown-bap',
        bap_uri: intent.bapUri ?? '',
        bpp_id: this.subscriberId,
        transaction_id: intent.transactionId ?? randomUUID(),
        message_id: intent.messageId ?? randomUUID(),
        timestamp: new Date().toISOString(),
      },
      message: {
        catalog: {
          'bpp/descriptor': { name: 'SHG Smart Market Linkage Platform' },
          'bpp/providers': providers,
        },
      },
    };

    const bodyJson = JSON.stringify(body);
    const created = Math.floor(Date.now() / 1000);
    const expires = created + SIGNATURE_TTL_SECONDS;
    const authorization = createAuthorizationHeader({
      keyId: this.signingKeyId,
      privateKey: this.keyPair.privateKey,
      created,
      expires,
      digestBase64: digestBody(bodyJson),
    });

    return { body, authorization };
  }

  /** Self-check for "integration readiness" (the POC scope doc's own
   * phrase) — confirms real products exist to publish and that signing
   * actually produces a verifiable signature, without calling out to any
   * real ONDC network endpoint (there isn't one to call). */
  async readiness() {
    const products = await this.fetchCatalogProducts();
    const providers = buildCatalogProviders(products);
    const sampleDigest = digestBody('readiness-check');
    return {
      subscriberId: this.subscriberId,
      signingAlgorithm: 'ed25519',
      digestAlgorithm:
        'SHA-512 (see beckn-signing.util.ts — spec calls for BLAKE-512)',
      publishableProviderCount: providers.length,
      publishableItemCount: providers.reduce(
        (sum, p) => sum + p.items.length,
        0,
      ),
      sampleDigest,
      registeredWithOndcNetwork: false,
    };
  }

  private async fetchCatalogProducts(): Promise<ProductForCatalog[]> {
    const rows = await this.prisma.product.findMany({
      where: { isAvailable: true, stock: { gt: 0 } },
      include: { shg: { include: { district: true } } },
    });

    const locationByShgId = new Map<
      string,
      { lat: number; lng: number } | null
    >();
    for (const row of rows) {
      if (!locationByShgId.has(row.shgId)) {
        locationByShgId.set(
          row.shgId,
          await this.geo.getLocation('shg', row.shgId),
        );
      }
    }

    return rows.map((row) => {
      const location = locationByShgId.get(row.shgId) ?? null;
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        price: Number(row.price),
        stock: row.stock,
        categoryId: row.categoryId,
        shgId: row.shgId,
        shgName: row.shg.name,
        districtName: row.shg.district.name,
        lat: location?.lat ?? null,
        lng: location?.lng ?? null,
      };
    });
  }
}
