// common/utils/hash.util.ts

import * as crypto from 'crypto';
import { AstroParams } from '../types/astro-params.type';
import { normalizeParams } from './normalize.util';

/**
 * 🔥 Base hash generator
 */
export const generateHash = (data: Record<string, any>, namespace: string) => {
  const normalized = normalizeGeneric(data);

  return crypto
    .createHash('sha256')
    .update(JSON.stringify({ namespace, ...normalized }))
    .digest('hex');
};

/**
 * 🔥 Kundli Hash
 */
export const generateKundliHash = (params: AstroParams) => {
  const normalized = normalizeParams(params);
  return generateHash(normalized, 'kundli');
};

/**
 * 🔥 Numerology Hash
 */
export const generateNumerologyHash = (params: {
  fullName: string;
  dob: string;
  lang: string;
}) => {
  return generateHash(params, 'numerology');
};

/**
 * 🔥 Generic normalization
 */
function normalizeGeneric(data: Record<string, any>) {
  return Object.keys(data)
    .sort()
    .reduce((acc: any, key) => {
      const value = data[key];

      if (value !== undefined && value !== null) {
        acc[key] =
          typeof value === 'string' ? value.trim().toLowerCase() : value;
      }

      return acc;
    }, {});
}
