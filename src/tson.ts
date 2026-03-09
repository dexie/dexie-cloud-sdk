/**
 * TSON (Typed JSON) support for Dexie Cloud SDK
 * 
 * TSON extends JSON with support for:
 * - Date objects
 * - Blob/File objects
 * - Map and Set
 * - BigInt
 * - undefined values
 * - TypedArrays (Uint8Array, etc.)
 * 
 * This enables seamless serialization of rich data types when
 * communicating with Dexie Cloud servers.
 */

import {
  TypesonSimplified,
  builtInTypeDefs,
  fileTypeDef,
  TypeDefSet
} from 'dexie-cloud-common';

/**
 * Custom type definitions for SDK-specific types
 */
const sdkTypeDefs: TypeDefSet = {
  // URL type support
  URL: {
    test: (val: any) => val instanceof URL,
    replace: (url: URL) => ({
      $t: 'URL',
      href: url.href
    }),
    revive: ({ href }: { href: string }) => new URL(href)
  }
};

/**
 * TSON instance configured for Dexie Cloud SDK
 * 
 * Supports all built-in types plus:
 * - File (browser file uploads)
 * - URL (for convenience)
 * 
 * Note: undefined is NOT included - it's only needed for mutations/UpdateSpec
 * where undefined means "delete this property". For normal data serialization,
 * omitting undefined is more efficient.
 */
export const TSON = TypesonSimplified(
  builtInTypeDefs,
  fileTypeDef,
  sdkTypeDefs
);

/**
 * Stringify a value using TSON
 * Handles Date, Blob, Map, Set, BigInt, undefined, etc.
 */
export function stringify(value: any, space?: number): string {
  return TSON.stringify(value, undefined, space);
}

/**
 * Parse a TSON string back to its original types
 */
export function parse<T = any>(text: string): T {
  return TSON.parse(text);
}

/**
 * Re-export for advanced users who need direct access
 */
export { TypesonSimplified, builtInTypeDefs } from 'dexie-cloud-common';
