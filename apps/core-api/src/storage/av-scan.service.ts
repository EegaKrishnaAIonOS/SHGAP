import {
  Injectable,
  InternalServerErrorException,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as net from 'node:net';

const CHUNK_SIZE = 1024 * 1024;

@Injectable()
export class AvScanService {
  private readonly logger = new Logger(AvScanService.name);
  private readonly host: string;
  private readonly port: number;

  constructor(config: ConfigService) {
    this.host = config.getOrThrow<string>('CLAMAV_HOST');
    this.port = config.getOrThrow<number>('CLAMAV_PORT');
  }

  /** Throws UnprocessableEntityException if the buffer is infected. */
  async assertClean(buffer: Buffer): Promise<void> {
    let reply: string;
    try {
      reply = await this.scanBuffer(buffer, 15_000);
    } catch (err) {
      this.logger.error(`ClamAV scan failed: ${(err as Error).message}`);
      throw new InternalServerErrorException(
        'Virus scan is currently unavailable',
      );
    }

    if (!isCleanReply(reply)) {
      this.logger.warn(`Rejected infected upload: ${reply}`);
      throw new UnprocessableEntityException('File failed the virus scan');
    }
  }

  /**
   * Speaks ClamAV's zINSTREAM protocol directly over TCP: a 4-byte big-endian
   * length prefix followed by that many bytes, repeated, terminated by a
   * zero-length chunk. Hand-rolled instead of using the `clamdjs` npm package
   * — that library has a real bug (verified independently: its `scanStream`
   * calls `readStream.pause()` on the first byte of any server response but
   * never `.resume()`s it, which can stall the upload mid-transfer before the
   * terminating zero-chunk is ever sent, especially for small/fast buffers —
   * clamd then returns an empty reply that reads as "not clean" even though
   * nothing was actually scanned).
   */
  private scanBuffer(buffer: Buffer, timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: this.host, port: this.port });
      const chunks: Buffer[] = [];
      let settled = false;

      const fail = (err: Error) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        reject(err);
      };

      socket.setTimeout(timeoutMs, () =>
        fail(new Error('ClamAV scan timed out')),
      );
      socket.on('error', fail);

      socket.on('connect', () => {
        socket.write('zINSTREAM\0');
        for (let offset = 0; offset < buffer.length; offset += CHUNK_SIZE) {
          const slice = buffer.subarray(offset, offset + CHUNK_SIZE);
          const lengthPrefix = Buffer.alloc(4);
          lengthPrefix.writeUInt32BE(slice.length, 0);
          socket.write(lengthPrefix);
          socket.write(slice);
        }
        const terminator = Buffer.alloc(4); // zero-length chunk signals end-of-stream
        socket.write(terminator);
      });

      socket.on('data', (chunk) => chunks.push(chunk));

      socket.on('end', () => {
        if (settled) return;
        settled = true;
        resolve(
          Buffer.concat(chunks).toString('utf8').replace(/\0/g, '').trim(),
        );
      });
    });
  }
}

function isCleanReply(reply: string): boolean {
  return reply.includes('OK') && !reply.includes('FOUND');
}
