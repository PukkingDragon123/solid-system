// Normalises licence strings from external providers into our LicenseId set.
// Anything we don't positively recognise becomes UNKNOWN and is therefore never played.

import type { LicenseId } from '../../shared/content';

export function licenseFromCcUrl(url: string | undefined | null): LicenseId {
  if (!url) return 'UNKNOWN';
  const u = url.toLowerCase();
  if (u.includes('publicdomain/zero')) return 'CC0';
  if (u.includes('publicdomain/mark')) return 'PDM';
  const m = /licenses\/([a-z-]+)\/(\d\.\d)/.exec(u);
  if (!m) return 'UNKNOWN';
  return fromParts(m[1], m[2]);
}

function fromParts(kind: string, version: string): LicenseId {
  const k = kind.replace(/^cc-/, '');
  if (k === 'by') return version.startsWith('4') ? 'CC-BY-4.0' : version.startsWith('3') ? 'CC-BY-3.0' : 'UNKNOWN';
  if (k === 'by-sa') return version.startsWith('4') ? 'CC-BY-SA-4.0' : version.startsWith('3') ? 'CC-BY-SA-3.0' : 'UNKNOWN';
  if (k === 'by-nc') return 'CC-BY-NC';
  if (k === 'by-nd') return 'CC-BY-ND';
  if (k === 'by-nc-sa') return 'CC-BY-NC-SA';
  if (k === 'by-nc-nd') return 'CC-BY-NC-ND';
  return 'UNKNOWN';
}

/** Openverse style: license "by-sa", license_version "4.0". */
export function licenseFromCode(code: string | undefined, version: string | undefined): LicenseId {
  if (!code) return 'UNKNOWN';
  const c = code.toLowerCase();
  if (c === 'cc0') return 'CC0';
  if (c === 'pdm') return 'PDM';
  return fromParts(c, version ?? '');
}

/** Wikimedia Commons LicenseShortName values such as "CC BY-SA 4.0", "Public domain", "CC0". */
export function licenseFromShortName(name: string | undefined): LicenseId {
  if (!name) return 'UNKNOWN';
  const n = name.trim().toLowerCase();
  if (n === 'cc0' || n.startsWith('cc0 ')) return 'CC0';
  if (n === 'public domain' || n === 'pd' || n.startsWith('pd-')) return 'PD';
  const m = /^cc[ -]([a-z-]+)[ -](\d\.\d)/.exec(n);
  if (m) return fromParts(m[1], m[2]);
  return 'UNKNOWN';
}
