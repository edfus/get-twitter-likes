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
            "\nset --smart-exit flag if auto exit at this point is expected.",
            "\n\nwiping out `xxx exists in db` log for now on..."
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

//NOTE: https://github.com/tweepy/tweepy/blob/8dba191518366fb756440302eff86d5a868e0306/tweepy/cursor.py#L127

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
  const statuses = await (max_id ? fetchFav({ max_id }) : fetchFav({ count: 5 }));

  if(max_id && max_id === statuses[0].id_str) // if(max_id): not the first fetch
      statuses.shift();
    /**
     * Intended to remove the first status 
     * (which should be exactly the same as the last status of last fetch)
     * 
     * BUT as id is larger than 2^53 - 1 thus truncated, we can't trust in the assumption above
     * so in case some favs being skipped, comparison had been added.
     */

  if(!statuses.length)
      return ;

  // get the minimum id
  let min_id_index = 0;
  let min_id_imprecise = statuses[min_id_index].id;

  for (let i = 1; i < statuses.length; i++) {
    if (min_id_imprecise > statuses[i].id) {
      min_id_index = i;
      min_id_imprecise = statuses[i].id;
    }
  }

  const next_max_id = statuses[min_id_index].id_str; // as id is imprecise

  for (let i = 0; i < statuses.length; i++) {
    yield statuses[i];

    // twitter rate-limits us to 75 requests / 15 minutes
    await new Promise(resolve => 
      setTimeout(resolve, 60000 * 15 / (72 * statuses.length)) // 72 for tolerance
    );
  }

  return yield* cursorAllFavs(next_max_id);
}

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
  ).then(response => {
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
              return resolve(JSON.parse(text));
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
            err => 
              err
              ? reject(err)
              : reject(
                `${response.statusCode} ${response.statusMessage}. Details in ./log.tmp.txt`
              )
          )
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