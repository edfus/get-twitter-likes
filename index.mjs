import { createWriteStream } from "fs";
import { pipeline } from "stream";
import { fetch as proxyFetch } from "./proxy-tunnel.mjs";
import { request as request_https } from "https";
import { getOauthData, getOauthHeader } from "./oauth.mjs";
import credentials from "./creds.mjs";
import SetDB from "./set-db.mjs"

// main
const db_path = './db.csv'; // Comma-separated values
const result_path = './favs.ndjson';

const useProxy = extractArg(/--(https?[-_])?proxy/) !== false;
const proxy = extractArg(/--(https?[-_])?proxy=/) || "http://127.0.0.1:7890";

if (useProxy)
  console.info("Using proxy: ".concat(proxy));

const in_db_counter_limit = 20;
const smart_exit = extractArg(/--smart-exit/) && extractArg(/--smart-exit=/) !== "false";

if(
  !credentials.username
  ||
  !credentials.consumer_key
  ||
  !credentials.consumer_secret
  ||
  !credentials.access_token_key
  ||
  !credentials.access_token_secret
)
 throw "insufficient credentials";

/**
 * main
 */
(async () => {
  const db = new SetDB(db_path);
  const favs = createWriteStream(result_path, { flags:'a' });
  
  await db.loaded;

  let counter = 0, in_db_counter = 0, in_db_logged = false;
  for await (const status of cursorAllFavs()) {
    if(!db.has(status.id_str)) {
      console.info(++counter);

      db.add(status.id_str);
      favs.write(JSON.stringify(status));
      favs.write("\n"); // in ndjson syntax
    } else {
      if(!in_db_logged) {
        console.info(++counter);
        console.info(`${status.id_str} exists in db`);
      }

      if(++in_db_counter >= in_db_counter_limit) {
        if(smart_exit)
          break;
        if(!in_db_logged && !extractArg(/--smart-exit=false/)) {
          in_db_logged = true;
          console.info(
            `Found ${in_db_counter} items existing in db,`,
            "indicating a strong likelihood of the user's newly liked tweets all being fetched.",
            "\nSet `--smart-exit` flag if auto exit at this point is expected.",
            "\n\nHiding `xxx exists in db` log for now on..."
          );
        }
      }
    }
  }

  favs.end(() => {
    console.info("Done.");
    process.exit(0);
  })
})();

// functions
const params = {
  screen_name: credentials.username,
  count: 200, // Must be less than or equal to 200;
  include_entities: true,
  tweet_mode: 'extended'
};

/**
 * https://developer.twitter.com/en/docs/twitter-api/v1/tweets/post-and-engage/api-reference/get-favorites-list
 * 
 * There is a possibility that the first 200 likes we fetched contain a status that is so old
 * that an according "void" will occur
 * — Favs born after it but weren't the 200 most recent Tweets liked would be invisible to us.
 * (sequential ids are assigned to the original statuses)
 * 
 * Solution: we only ask for *5* most recently liked Tweets in the initial fetch.
 * Just make sure the top 5 Tweets in your https://twitter.com/YOURUSERNAME/likes timeline
 * is up to date.
 */
async function* cursorAllFavs (max_id) {
  const { rateLimit, statuses } = await (max_id ? fetchFav({ max_id }) : fetchFav({ count: 5 }));

  if(max_id && max_id === statuses[0].id_str) // if(max_id): not the first fetch
      statuses.shift();

  if(!statuses.length)
      return ;

  // get the minimum id
  let min_id_index = 0;
  let min_id = BigInt(statuses[min_id_index].id_str);

  for (let i = 1; i < statuses.length; i++) {
    const id_i = BigInt(statuses[i].id);
    if (min_id > id_i) {
      min_id_index = i;
      min_id = id_i;
    }
  }

  const next_max_id = statuses[min_id_index].id_str;

  for (let i = 0; i < statuses.length; i++) {
    yield statuses[i];

    // twitter rate-limits us to rateLimit.remaining requests / rateLimit.reset seconds
    await new Promise(resolve => 
      // 72 for tolerance
      setTimeout(
        resolve,
        1000 * rateLimit.reset / ((rateLimit.remaining * statuses.length) || 1)
      ).unref()
    );
  }

  return yield* cursorAllFavs(next_max_id);
}

const isRetriedWeakMap = new WeakMap();

async function fetchFav (additionalParams) {
  return oauthFetch(
    "https://api.twitter.com/1.1/favorites/list.json",
    {
      method: "GET",
      qs: additionalParams ? {...params, ...additionalParams} : params,
      headers: {
        "Accept": "application/json"
      }
    }
  )
  .catch(err => {
    switch (err.code) {
      case "ECONNRESET":
      case "ETIMEDOUT":
        console.error(`Error: ${err.code}, check your internet connection or proxy settings.`);
        return process.exit(1);
      default: throw err;
    }
  })
  .then(response => {
    if(response.statusCode === 200) {
      console.info(`x-rate-limit-remaining: ${response.headers["x-rate-limit-remaining"]}`);
      return new Promise((resolve, reject) => {
        let chunks = [];
        response
          .on("error", reject)
          .on("data", chunk => chunks.push(chunk))
          .on("end", () => {
            try {
              const text = Buffer.concat(chunks).toString();
              chunks = null;
              return resolve({
                rateLimit: {
                  limit: Number(response.headers["x-rate-limit-limit"]),
                  remaining: Number(response.headers["x-rate-limit-remaining"]),
                  reset: 
                    Number(response.headers["x-rate-limit-reset"])
                      - (Date.now() / 1000).toFixed(0)
                },
                statuses: JSON.parse(text)
              });
            } catch (error) {
              return reject(error);
            }
          })
      });
    } else {
      return new Promise((resolve, reject) => {
        try {
          pipeline(
            response,
            createWriteStream("./log.tmp.txt"),
            err => {
              if(err) {
                switch (err.code) {
                  // connection interrupted
                  case "ECONNRESET":
                    if(isRetriedWeakMap.has(additionalParams)) {
                      console.error(
                        `Through retried, ${JSON.stringify(additionalParams)} is still failing with ${err.code}`
                      );
                      isRetriedWeakMap.delete(additionalParams);
                      return resolve([]);
                    } else {
                      isRetriedWeakMap.set(additionalParams, true);
                      return fetchFav(additionalParams).then(resolve, reject);
                    }
                  default: reject(err);
                }
              } else {
                reject(
                  `${response.statusCode} ${response.statusMessage}. Details in ./log.tmp.txt`
                );
              }
          })
        } catch (error) {
          reject(error);
        }
      })
    }
  })
}

async function oauthFetch (url, options) {
  const uriObject = new URL(url);

  Object.entries(options.qs)
        .forEach(([key, value]) => uriObject.searchParams.set(key, value))

  options.headers.Authorization = getOauthHeader(
    getOauthData(
      credentials, 
      {
        url: uriObject,
        method: options.method
      }
    )
  ).Authorization;

  if(useProxy) {
    options.proxy = proxy;
    return proxyFetch(uriObject, options);
  } else {
    return new Promise((resolve, reject) => {
      request_https(uriObject, options)
        .once("response", resolve)
        .once("error", reject)
        .end();
    });
  }
}

function extractArg(matchPattern) {
  for (let i = 2; i < process.argv.length; i++) {
    if (matchPattern.test(process.argv[i])) {
      const split = process.argv[i].split(matchPattern)
      return split[split.length - 1];
    }
  }
  return false;
}