import crypto from "crypto";
// refactoring of https://github.com/ddo/oauth-1.0a
// https://developer.twitter.com/en/docs/authentication/oauth-1-0a/authorizing-a-request

//TODO: tolerate multiple same keys
function getOauthData(credentials, { method, url, data = {}, form = {}, qs = {} }) {
  const oauth_data = {
    oauth_consumer_key: credentials.consumer_key,
    oauth_token: credentials.access_token_key,
    oauth_nonce: crypto.randomBytes(32).toString('base64'),
    oauth_timestamp: parseInt(new Date().getTime() / 1000),
    oauth_version: "1.0",
    oauth_signature_method: "HMAC-SHA1"
  };

  const uriObject = url instanceof URL ? url : new URL(url);

  const searchParams = {
    ...Object.fromEntries(uriObject.searchParams),
    ...data,
    ...form,
    ...qs
  };

  // signature
  oauth_data.oauth_signature = (
    crypto
      .createHmac(
        "sha1",
        // signing key
        [
          percentEncode(credentials.consumer_secret),
          percentEncode(credentials.access_token_secret)
        ].join("&")
      )
      .update(
        getBaseString(
          oauth_data,
          {
            method,
            baseURL: `${uriObject.protocol}//${uriObject.host}${uriObject.pathname}`,
            searchParams
          }
        )
      )
      .digest("base64")
  );

  return oauth_data;
}

// to header Authorization string
function getOauthHeader(oauth_data) {
  return {
    Authorization: "OAuth ".concat(
      Object.entries(oauth_data)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
        .map(([key, value]) => `${percentEncode(key)}="${percentEncode(value)}"`)
        .join(", ")
    )
  };
}

function getBaseString(oauth_data, { method, baseURL, searchParams }) {
  return [
    method.toUpperCase(),
    percentEncode(baseURL),
    percentEncode(getParameterString(oauth_data, searchParams))
  ].join("&");
}

function getParameterString(oauth_data, searchParams) {
  return (
    Object.entries({
      ...oauth_data,
      ...searchParams
    })
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([key, value]) => `${percentEncode(key)}=${percentEncode(value)}`)
      .join("&")
  );
};

function percentEncode(str) {
  return encodeURIComponent(str)
    // for posting status, etc.
    .replace(/\!/g, "%21")
    .replace(/\*/g, "%2A")
    .replace(/\"/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29");
};

export { getOauthData, getOauthHeader, percentEncode }