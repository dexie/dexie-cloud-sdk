/**
 * Unit tests for DataManager
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataManager } from '../../src/data.ts';
import { DexieCloudError } from '../../src/types.ts';

const DB_URL = 'https://z1test.dexie.cloud';
const TOKEN = 'test-token';

function mockResponse(data: any, ok = true, status = 200): Response {
  const text = JSON.stringify(data);
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    text: async () => text,
    json: async () => data,
    headers: new Headers(),
    redirected: false,
    type: 'basic',
    url: '',
    clone: () => mockResponse(data, ok, status),
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
    headers: new Headers(),
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

describe('DataManager', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let manager: DataManager;

  beforeEach(() => {
    fetchMock = vi.fn();
    manager = new DataManager(DB_URL, { fetch: fetchMock });
  });

  describe('list', () => {
    it('GETs /{table} with auth header', async () => {
      const items = [{ id: '1', name: 'Alice' }, { id: '2', name: 'Bob' }];
      fetchMock.mockResolvedValue(mockResponse(items));

      const result = await manager.list('users', TOKEN);

      expect(fetchMock).toHaveBeenCalledWith(
        `${DB_URL}/users`,
        expect.objectContaining({ method: 'GET', headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }) })
      );
      expect(result).toEqual(items);
    });

    it('passes realm as query param', async () => {
      fetchMock.mockResolvedValue(mockResponse([]));
      await manager.list('users', TOKEN, { realm: 'realm123' });
      expect(fetchMock).toHaveBeenCalledWith(
        `${DB_URL}/users?realm=realm123`,
        expect.anything()
      );
    });

    it('throws DexieCloudError on HTTP error', async () => {
      fetchMock.mockResolvedValue(mockErrorResponse('Forbidden', 403));
      await expect(manager.list('users', TOKEN)).rejects.toThrow(DexieCloudError);
    });
  });

  describe('get', () => {
    it('GETs /{table}/{id}', async () => {
      const item = { id: '42', name: 'Alice' };
      fetchMock.mockResolvedValue(mockResponse(item));

      const result = await manager.get('users', '42', TOKEN);

      expect(fetchMock).toHaveBeenCalledWith(
        `${DB_URL}/users/42`,
        expect.objectContaining({ method: 'GET' })
      );
      expect(result).toEqual(item);
    });

    it('throws on 404', async () => {
      fetchMock.mockResolvedValue(mockErrorResponse('Not found', 404));
      await expect(manager.get('users', 'missing', TOKEN)).rejects.toThrow(DexieCloudError);
    });
  });

  describe('create', () => {
    it('POSTs to /{table} with body', async () => {
      const obj = { name: 'Alice' };
      const created = { id: 'new-id', ...obj };
      fetchMock.mockResolvedValue(mockResponse(created));

      const result = await manager.create('users', obj, TOKEN);

      expect(fetchMock).toHaveBeenCalledWith(
        `${DB_URL}/users`,
        expect.objectContaining({ method: 'POST' })
      );
      expect(result).toEqual(created);
    });
  });

  describe('update', () => {
    it('PUTs to /{table}/{id} with body', async () => {
      const obj = { id: '42', name: 'Updated' };
      fetchMock.mockResolvedValue(mockResponse(obj));

      const result = await manager.update('users', '42', obj, TOKEN);

      expect(fetchMock).toHaveBeenCalledWith(
        `${DB_URL}/users/42`,
        expect.objectContaining({ method: 'PUT' })
      );
      expect(result).toEqual(obj);
    });
  });

  describe('delete', () => {
    it('DELETEs /{table}/{id}', async () => {
      fetchMock.mockResolvedValue(mockResponse(null, true, 204));

      await expect(manager.delete('users', '42', TOKEN)).resolves.toBeUndefined();
      expect(fetchMock).toHaveBeenCalledWith(
        `${DB_URL}/users/42`,
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('throws on error', async () => {
      fetchMock.mockResolvedValue(mockErrorResponse('Not found', 404));
      await expect(manager.delete('users', 'missing', TOKEN)).rejects.toThrow(DexieCloudError);
    });
  });

  describe('bulkCreate', () => {
    it('creates each object sequentially', async () => {
      const objects = [{ name: 'Alice' }, { name: 'Bob' }];
      fetchMock
        .mockResolvedValueOnce(mockResponse({ id: '1', name: 'Alice' }))
        .mockResolvedValueOnce(mockResponse({ id: '2', name: 'Bob' }));

      const results = await manager.bulkCreate('users', objects, TOKEN);

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ id: '1', name: 'Alice' });
      expect(results[1]).toEqual({ id: '2', name: 'Bob' });
    });

    it('returns empty array for empty input', async () => {
      const result = await manager.bulkCreate('users', [], TOKEN);
      expect(result).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
