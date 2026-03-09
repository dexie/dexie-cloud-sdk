/**
 * Unit tests for BlobManager
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BlobManager } from '../../src/blob.ts';
import { DexieCloudError } from '../../src/types.ts';

const DB_URL = 'https://z1test.dexie.cloud';
const TOKEN = 'test-token';

function uint8(data: number[]): Uint8Array {
  return new Uint8Array(data);
}

function mockBinaryResponse(data: Uint8Array, contentType = 'application/octet-stream', ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    text: async () => '',
    json: async () => { throw new Error('not json'); },
    headers: { get: (h: string) => h === 'content-type' ? contentType : null } as any,
    redirected: false,
    type: 'basic',
    url: '',
    clone: () => mockBinaryResponse(data, contentType, ok, status),
    body: null,
    bodyUsed: false,
    arrayBuffer: async () => data.buffer,
    blob: async () => new Blob([data]),
    formData: async () => new FormData(),
  } as Response;
}

function mockJsonResponse(data: any, ok = true, status = 200): Response {
  const text = JSON.stringify(data);
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    text: async () => text,
    json: async () => data,
    headers: { get: () => null } as any,
    redirected: false,
    type: 'basic',
    url: '',
    clone: () => mockJsonResponse(data, ok, status),
    body: null,
    bodyUsed: false,
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => new Blob(),
    formData: async () => new FormData(),
  } as Response;
}

function mockErrorResponse(text: string, status: number): Response {
  return {
    ok: false,
    status,
    statusText: 'Error',
    text: async () => text,
    json: async () => { throw new Error('not json'); },
    headers: { get: () => null } as any,
    redirected: false,
    type: 'basic',
    url: '',
    clone: () => mockErrorResponse(text, status),
    body: null,
    bodyUsed: false,
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => new Blob(),
    formData: async () => new FormData(),
  } as Response;
}

describe('BlobManager', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let manager: BlobManager;

  beforeEach(() => {
    fetchMock = vi.fn();
    manager = new BlobManager(DB_URL, { fetch: fetchMock });
  });

  describe('upload', () => {
    it('PUTs to /blob/{id} with correct headers', async () => {
      fetchMock.mockResolvedValue(mockJsonResponse({ ref: '1:abc123' }));

      const data = uint8([1, 2, 3]);
      const ref = await manager.upload(data, TOKEN, 'image/png');

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(`${DB_URL}/blob/`),
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            Authorization: `Bearer ${TOKEN}`,
            'Content-Type': 'image/png',
          }),
        })
      );
      expect(ref).toBe('1:abc123');
    });

    it('falls back to "1:{id}" when server returns empty body', async () => {
      const emptyResponse = {
        ok: true, status: 200, statusText: 'OK',
        text: async () => '',
        json: async () => { throw new Error(); },
        headers: { get: () => null } as any,
        redirected: false, type: 'basic', url: '',
        clone: function() { return this; },
        body: null, bodyUsed: false,
        arrayBuffer: async () => new ArrayBuffer(0),
        blob: async () => new Blob(),
        formData: async () => new FormData(),
      } as Response;
      fetchMock.mockResolvedValue(emptyResponse);

      const ref = await manager.upload(uint8([1]), TOKEN);
      expect(ref).toMatch(/^1:[a-f0-9]+$/);
    });

    it('throws on upload error', async () => {
      fetchMock.mockResolvedValue(mockErrorResponse('Unauthorized', 401));
      await expect(manager.upload(uint8([1]), TOKEN)).rejects.toThrow(DexieCloudError);
    });

    it('accepts ArrayBuffer input', async () => {
      fetchMock.mockResolvedValue(mockJsonResponse({ ref: '1:xyz' }));
      const buf = new ArrayBuffer(4);
      await expect(manager.upload(buf, TOKEN)).resolves.toBeDefined();
    });
  });

  describe('download', () => {
    it('GETs /blob/{ref} and returns Uint8Array + contentType', async () => {
      const data = uint8([10, 20, 30]);
      fetchMock.mockResolvedValue(mockBinaryResponse(data, 'image/jpeg'));

      const result = await manager.download('1:abc', TOKEN);

      expect(fetchMock).toHaveBeenCalledWith(
        `${DB_URL}/blob/1%3Aabc`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
        })
      );
      expect(result.data).toBeInstanceOf(Uint8Array);
      expect(result.contentType).toBe('image/jpeg');
    });

    it('throws on download error', async () => {
      fetchMock.mockResolvedValue(mockErrorResponse('Not found', 404));
      await expect(manager.download('1:missing', TOKEN)).rejects.toThrow(DexieCloudError);
    });
  });

  describe('processForUpload (auto mode)', () => {
    it('replaces inline blobs with BlobRefs', async () => {
      fetchMock.mockResolvedValue(mockJsonResponse({ ref: '1:uploaded' }));

      const obj = {
        name: 'test',
        avatar: {
          _bt: 'Blob',
          v: btoa('fake-png-data'),
          ct: 'image/png',
        },
      };

      const result = await manager.processForUpload(obj, TOKEN);

      expect(result.name).toBe('test');
      expect(result.avatar._bt).toBe('Blob');
      expect(result.avatar.ref).toBe('1:uploaded');
      expect(result.avatar.v).toBeUndefined();
    });

    it('handles nested objects recursively', async () => {
      fetchMock.mockResolvedValue(mockJsonResponse({ ref: '1:nested' }));

      const obj = {
        nested: {
          deep: {
            _bt: 'Uint8Array',
            v: btoa('data'),
          },
        },
      };

      const result = await manager.processForUpload(obj, TOKEN);
      expect(result.nested.deep.ref).toBe('1:nested');
      expect(result.nested.deep.v).toBeUndefined();
    });

    it('handles arrays with inline blobs', async () => {
      fetchMock
        .mockResolvedValueOnce(mockJsonResponse({ ref: '1:first' }))
        .mockResolvedValueOnce(mockJsonResponse({ ref: '1:second' }));

      const arr = [
        { _bt: 'Blob', v: btoa('a') },
        { _bt: 'Blob', v: btoa('b') },
      ];

      const result = await manager.processForUpload(arr, TOKEN);
      expect(result[0].ref).toBe('1:first');
      expect(result[1].ref).toBe('1:second');
    });

    it('passes through non-blob values unchanged', async () => {
      const obj = { id: '1', count: 42, tags: ['a', 'b'] };
      const result = await manager.processForUpload(obj, TOKEN);
      expect(result).toEqual(obj);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('processForRead (auto mode)', () => {
    it('replaces BlobRefs with inline blobs', async () => {
      const blobData = uint8([1, 2, 3]);
      fetchMock.mockResolvedValue(mockBinaryResponse(blobData, 'image/png'));

      const obj = {
        name: 'test',
        avatar: {
          _bt: 'Blob',
          ref: '1:someblob',
          size: 3,
          ct: 'image/png',
        },
      };

      const result = await manager.processForRead(obj, TOKEN);
      expect(result.name).toBe('test');
      expect(result.avatar._bt).toBe('Blob');
      expect(result.avatar.v).toBeDefined();
      expect(result.avatar.ref).toBeUndefined();
    });

    it('preserves non-BlobRef objects', async () => {
      const obj = { id: '1', name: 'test' };
      const result = await manager.processForRead(obj, TOKEN);
      expect(result).toEqual(obj);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('lazy mode', () => {
    let lazyManager: BlobManager;

    beforeEach(() => {
      lazyManager = new BlobManager(DB_URL, { fetch: fetchMock }, 'lazy');
    });

    it('processForUpload returns object unchanged in lazy mode', async () => {
      const obj = {
        avatar: { _bt: 'Blob', v: btoa('data') },
      };
      const result = await lazyManager.processForUpload(obj, TOKEN);
      expect(result).toBe(obj); // same reference, no processing
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('processForRead returns object unchanged in lazy mode', async () => {
      const obj = {
        avatar: { _bt: 'Blob', ref: '1:abc', size: 3 },
      };
      const result = await lazyManager.processForRead(obj, TOKEN);
      expect(result).toBe(obj); // same reference, no processing
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
