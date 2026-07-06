import { AstroParams } from '../types/astro-params.type';

export const normalizeParams = (params: AstroParams) => {
  return {
    dob: params.dob.trim(),

    // ensure HH:mm:ss format
    tob: params.tob.length === 5 ? `${params.tob}:00` : params.tob,

    // fix float precision
    lat: Number(params.lat.toFixed(6)),
    lon: Number(params.lon.toFixed(6)),

    timezone: Number(params.timezone.toFixed(2)),
  };
};
