type HeadersWithGetSetCookie = Headers & {
  getSetCookie?: () => string[];
};

type HeadersWithRaw = Headers & {
  raw?: () => Record<string, string[]>;
};

const splitSetCookieHeader = (headerValue: string): string[] => {
  const cookies: string[] = [];
  let start = 0;
  let inExpires = false;
  const lower = headerValue.toLowerCase();

  for (let i = 0; i < headerValue.length; i += 1) {
    if (lower.startsWith('expires=', i)) {
      inExpires = true;
    }

    const char = headerValue[i];
    if (char === ';' && inExpires) {
      inExpires = false;
      continue;
    }

    if (char === ',' && !inExpires) {
      const chunk = headerValue.slice(start, i).trim();
      if (chunk) {
        cookies.push(chunk);
      }
      start = i + 1;
    }
  }

  const finalChunk = headerValue.slice(start).trim();
  if (finalChunk) {
    cookies.push(finalChunk);
  }

  return cookies;
};

export const getSetCookieHeaders = (headers: Headers): string[] => {
  const getSetCookie = (headers as HeadersWithGetSetCookie).getSetCookie;
  if (typeof getSetCookie === 'function') {
    const values = getSetCookie.call(headers);
    if (values?.length) {
      return values;
    }
  }

  const raw = (headers as HeadersWithRaw).raw;
  if (typeof raw === 'function') {
    const rawHeaders = raw.call(headers);
    const values = rawHeaders?.['set-cookie'];
    if (values?.length) {
      return values;
    }
  }

  const singleValue = headers.get('set-cookie');
  if (!singleValue) {
    return [];
  }

  return splitSetCookieHeader(singleValue);
};

export type ParsedCookieAttributes = {
  httpOnly?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
  path?: string;
  secure?: boolean;
  maxAge?: number;
  expires?: Date;
};

export const parseSetCookieHeader = (
  cookieString: string,
): { name: string; value: string; attributes: ParsedCookieAttributes } | null => {
  const parts = cookieString.split(';');
  const [nameValue, ...attributesParts] = parts;
  const [name, ...valueParts] = nameValue.split('=');
  const value = valueParts.join('=');

  if (!name) {
    return null;
  }

  const attributes: ParsedCookieAttributes = {
    sameSite: 'lax',
    path: '/',
  };

  attributesParts.forEach((attr) => {
    const trimmed = attr.trim();
    const lower = trimmed.toLowerCase();

    if (lower === 'httponly') {
      attributes.httpOnly = true;
      return;
    }
    if (lower === 'secure') {
      attributes.secure = true;
      return;
    }
    if (lower.startsWith('samesite=')) {
      const value = lower.split('=')[1];
      if (value === 'strict' || value === 'none' || value === 'lax') {
        attributes.sameSite = value;
      }
      return;
    }
    if (lower.startsWith('path=')) {
      attributes.path = trimmed.split('=')[1];
      return;
    }
    if (lower.startsWith('max-age=')) {
      const maxAge = Number.parseInt(trimmed.split('=')[1], 10);
      if (!Number.isNaN(maxAge)) {
        attributes.maxAge = maxAge;
      }
      return;
    }
    if (lower.startsWith('expires=')) {
      const expiresValue = trimmed.substring(8);
      const parsedDate = new Date(expiresValue);
      if (!Number.isNaN(parsedDate.getTime())) {
        attributes.expires = parsedDate;
      }
    }
  });

  return {
    name: name.trim(),
    value: value.trim(),
    attributes,
  };
};
