import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma } from '@shgap/database';
import { PrismaService } from '../prisma/prisma.service';
import { PaginatedResult, paginate } from '../common/dto/pagination-query.dto';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';

export interface RecordAuditEntryInput {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeState?: unknown;
  afterState?: unknown;
  ipAddress?: string | null;
}

export interface ChainVerificationResult {
  valid: boolean;
  totalChecked: number;
  brokenAtId: string | null;
}

/**
 * Tamper-evident audit trail (T22/ADR-0031). Each row's `hash` covers its
 * own fields plus the previous row's hash, so editing any historical row —
 * including `beforeState`/`afterState`, which someone might be tempted to
 * "correct" after the fact — changes that row's recomputed hash and breaks
 * the chain for every row after it. `verifyChain()` actually recomputes and
 * checks every hash; it doesn't just assert the log is trustworthy.
 *
 * Known limitation, not hidden: `record()` reads the last hash and inserts
 * in two separate steps, not one atomic operation. Two audit writes racing
 * at the exact same instant could both read the same "last hash" and
 * produce two rows pointing at the same previous link — a real gap for a
 * high-concurrency deployment, acceptable for this POC's actual write
 * volume, and one `verifyChain()` would surface (two rows sharing a
 * previousHash) rather than silently miss.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: RecordAuditEntryInput): Promise<void> {
    const last = await this.prisma.auditLog.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { hash: true },
    });
    const previousHash = last?.hash ?? null;
    const hash = computeHash(entry, previousHash);

    await this.prisma.auditLog.create({
      data: {
        actorUserId: entry.actorUserId ?? undefined,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        beforeState: toInputJson(entry.beforeState),
        afterState: toInputJson(entry.afterState),
        ipAddress: entry.ipAddress ?? undefined,
        previousHash,
        hash,
      },
    });
  }

  async verifyChain(): Promise<ChainVerificationResult> {
    const rows = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'asc' },
    });
    let previousHash: string | null = null;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.previousHash !== previousHash) {
        return { valid: false, totalChecked: i + 1, brokenAtId: row.id };
      }
      const expectedHash = computeHash(
        {
          actorUserId: row.actorUserId,
          action: row.action,
          entityType: row.entityType,
          entityId: row.entityId,
          beforeState: row.beforeState,
          afterState: row.afterState,
          ipAddress: row.ipAddress,
        },
        previousHash,
      );
      if (expectedHash !== row.hash) {
        return { valid: false, totalChecked: i + 1, brokenAtId: row.id };
      }
      previousHash = row.hash;
    }

    return { valid: true, totalChecked: rows.length, brokenAtId: null };
  }

  async findAll(query: QueryAuditLogDto): Promise<PaginatedResult<unknown>> {
    const where: Prisma.AuditLogWhereInput = {
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.pageSize,
      }),
    ]);
    return paginate(rows, total, query);
  }
}

/** Recursively sorts object keys before stringifying — Postgres's JSONB
 * storage doesn't guarantee preserving the exact key order a value was
 * inserted with, so hashing a plain `JSON.stringify` of a row read back
 * from the DB could disagree with the hash computed at write time for
 * reasons that have nothing to do with tampering. Sorting keys on both
 * ends makes the hash depend only on content, never on incidental order. */
function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  // Caught by real end-to-end verification, not assumed: a raw controller
  // return value (what AuditInterceptor passes as afterState) can carry
  // real `Date` objects, but the same data read back after a JSONB
  // round-trip comes back as plain ISO strings — `Date` has no enumerable
  // own properties, so treating it as a generic object below would hash
  // it as `{}` at write time and as a real string at verify time, a false
  // "tampered" result with nothing actually tampered.
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}

function computeHash(
  entry: {
    actorUserId?: string | null;
    action: string;
    entityType: string;
    entityId: string;
    beforeState?: unknown;
    afterState?: unknown;
    ipAddress?: string | null;
  },
  previousHash: string | null,
): string {
  const canonical = canonicalJson({
    actorUserId: entry.actorUserId ?? null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    beforeState: entry.beforeState ?? null,
    afterState: entry.afterState ?? null,
    ipAddress: entry.ipAddress ?? null,
    previousHash,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

function toInputJson(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined ? undefined : (value as Prisma.InputJsonValue);
}
