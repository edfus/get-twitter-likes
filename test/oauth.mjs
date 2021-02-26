import { getOauthData, getOauthHeader } from "../oauth.mjs";
import { strictEqual, deepStrictEqual } from "assert";
import crypto from "crypto";

// overide for testing only !!!
Date.prototype.getTime = function () {
  return 1318622958 * 1000;
};

// overide for testing only !!!
crypto.randomBytes = new Proxy(crypto.randomBytes, {
  apply(target, thisArg, argArray) {
    if (32 === argArray[0])
      return {
        toString (enc) {
          return 'kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg';
        }
      }
    else debugger;
  }
});

describe("Twitter Sample", function () {
  const credentials = {
    consumer_key: "xvz1evFS4wEEPTGEFPHBog",
    consumer_secret: "kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw",
    access_token_key: "370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb",
    access_token_secret: "LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE"
  }

  const request = {
    url: 'https://api.twitter.com/1.1/statuses/update.json?include_entities=true',
    method: 'POST',
    form: {
      status: 'Hello Ladies + Gentlemen, a signed OAuth request!'
    }
  };

  describe("getOauthData", function () {
    it("should be equal to Twitter example", function () {
      deepStrictEqual(
        {
          oauth_consumer_key: "xvz1evFS4wEEPTGEFPHBog",
          oauth_nonce: "kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg",
          oauth_signature_method: "HMAC-SHA1",
          oauth_timestamp: 1318622958,
          oauth_version: "1.0",
          oauth_token: "370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb",
          oauth_signature: "hCtSmYh+iHYCEqBWrE7C7hYmtUk="
        },
        getOauthData(credentials, request)
      );
    });
  });

  describe("getOauthHeader", function () {
    it("should be equal to Twitter example", function () {
      strictEqual(
        getOauthHeader(getOauthData(credentials, request)).Authorization,
        'OAuth oauth_consumer_key="xvz1evFS4wEEPTGEFPHBog", oauth_nonce="kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg", oauth_signature="hCtSmYh%2BiHYCEqBWrE7C7hYmtUk%3D", oauth_signature_method="HMAC-SHA1", oauth_timestamp="1318622958", oauth_token="370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb", oauth_version="1.0"'
      );
    });
  });

  describe("versus oauth-1.0a", () => {
    let credentials;
    let OAuth;
  
    before(async function () {
      try {
        credentials = (await import("../creds.mjs")).default;
        OAuth = (await import("oauth-1.0a")).default;
      } catch (error) {
        console.error(error);
        this.skip();
      }
    });
  
    it("should be deep strict equal", async () => {
      const request = {
        url: "https://api.twitter.com/1.1/favorites/list.json",
        method: "GET",
        data: {
          screen_name: credentials.username,
          count: 200,
          include_entities: true,
          tweet_mode: 'extended'
        }
      };
  
      const oauth = new OAuth({
        consumer: { key: credentials.consumer_key, secret: credentials.consumer_secret },
        signature_method: 'HMAC-SHA1',
        hash_function(base_string, key) {
            return crypto
                .createHmac('sha1', key)
                .update(base_string)
                .digest('base64')
        },
      });
  
      //overide for testing only !!!
      oauth.getTimeStamp = function() {
          return 1318622958;
      };
  
      //overide for testing only !!!
      oauth.getNonce = function(length) {
          return 'kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg';
      };
  
      const token = {
        key: credentials.access_token_key,
        secret: credentials.access_token_secret,
      }  
  
      deepStrictEqual(
        Object.entries(oauth.authorize(request, token))
              .reduce(
                (newObj, [key, value]) => {
                  if(key.startsWith("oauth_"))
                    newObj[key] = value;
                  return newObj;
                },
                {}
              ),
        getOauthData(credentials, request)
      );
  
      deepStrictEqual(
        oauth.toHeader(oauth.authorize(request, token)),
        getOauthHeader(getOauthData(credentials, request))
      );
    });
  });
});