/**
 * HTTP utilities with TSON support
 * 
 * Wraps fetch responses and request bodies with TSON
 * for automatic serialization of Date, Blob, Map, Set, etc.
 */

import { TSON } from './tson.js';

/**
 * Parse a response body as TSON (or JSON fallback)
 * Automatically handles Date, Blob, Map, Set, etc.
 */
export async function parseResponse<T = any>(response: Response): Promise<T> {
  const text = await response.text();
  
  if (!text || text.trim() === '') {
    return undefined as T;
  }
  
  try {
    // TSON.parse handles both TSON-encoded and plain JSON
    return TSON.parse(text) as T;
  } catch (error) {
    // If TSON parsing fails, throw descriptive error
    throw new Error(`Failed to parse response: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Stringify a request body as TSON
 * Automatically handles Date, Blob, Map, Set, etc.
 */
export function stringifyBody(data: any): string {
  if (data === undefined || data === null) {
    return '';
  }
  
  try {
    return TSON.stringify(data);
  } catch (error) {
    throw new Error(`Failed to stringify request body: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Helper to create JSON request options with TSON body
 */
export function jsonRequest(method: string, data?: any, headers?: Record<string, string>): RequestInit {
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };
  
  if (data !== undefined) {
    options.body = stringifyBody(data);
  }
  
  return options;
}
