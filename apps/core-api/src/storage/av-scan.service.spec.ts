import {
  InternalServerErrorException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter } from 'node:events';
import * as net from 'node:net';
import { AvScanService } from './av-scan.service';

jest.mock('node:net');

class FakeSocket extends EventEmitter {
  written: Buffer[] = [];
  destroyed = false;
  setTimeout(_ms: number, _cb: () => void) {
    return this;
  }
  write(data: Buffer | string) {
    this.written.push(Buffer.isBuffer(data) ? data : Buffer.from(data));
    return true;
  }
  destroy() {
    this.destroyed = true;
  }
}

describe('AvScanService', () => {
  let config: ConfigService;
  let service: AvScanService;
  let socket: FakeSocket;

  beforeEach(() => {
    config = {
      getOrThrow: (key: string) =>
        ({ CLAMAV_HOST: 'localhost', CLAMAV_PORT: 3310 })[key],
    } as unknown as ConfigService;
    socket = new FakeSocket();
    (net.createConnection as jest.Mock).mockReturnValue(socket);
    service = new AvScanService(config);
  });

  it('sends the zINSTREAM preamble and a terminating zero-length chunk', async () => {
    const promise = service.assertClean(Buffer.from('hello'));
    socket.emit('connect');
    socket.emit('data', Buffer.from('stream: OK\0'));
    socket.emit('end');
    await promise;

    expect(socket.written[0].toString()).toBe('zINSTREAM\0');
    const last = socket.written[socket.written.length - 1];
    expect(last.readUInt32BE(0)).toBe(0); // terminating chunk
  });

  it('resolves without throwing for a clean reply', async () => {
    const promise = service.assertClean(Buffer.from('hello'));
    socket.emit('connect');
    socket.emit('data', Buffer.from('stream: OK\0'));
    socket.emit('end');
    await expect(promise).resolves.toBeUndefined();
  });

  it('throws UnprocessableEntityException when clamd reports a virus FOUND', async () => {
    const promise = service.assertClean(Buffer.from('eicar'));
    socket.emit('connect');
    socket.emit('data', Buffer.from('stream: Eicar-Test-Signature FOUND\0'));
    socket.emit('end');
    await expect(promise).rejects.toThrow(UnprocessableEntityException);
  });

  it('throws UnprocessableEntityException for an empty reply (regression: a stalled/incomplete scan must not be treated as clean)', async () => {
    const promise = service.assertClean(Buffer.from('hello'));
    socket.emit('connect');
    socket.emit('end');
    await expect(promise).rejects.toThrow(UnprocessableEntityException);
  });

  it('wraps a socket error as InternalServerErrorException', async () => {
    const promise = service.assertClean(Buffer.from('hello'));
    socket.emit('connect');
    socket.emit('error', new Error('ECONNREFUSED'));
    await expect(promise).rejects.toThrow(InternalServerErrorException);
  });
});
