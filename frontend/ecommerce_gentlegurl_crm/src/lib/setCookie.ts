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
