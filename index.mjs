import request from 'request'; // switching to request for oauth convenience.
import credentials from "./creds.mjs";
import fs from "fs";

// https://developer.twitter.com/en/docs/twitter-api/v1/tweets/post-and-engage/api-reference/get-favorites-list
const params = {
  screen_name: credentials.username,
  count: 200, // Must be less than or equal to 200;
  include_entities: true,
  tweet_mode: 'extended'
};

const fetch = request.defaults({
  headers: {
    "Accept": "*/*",
    "Content-type": "application/json",
    "Connection": 'close',
    'User-Agent': 'some meaningless text',
  },
  // proxy: "http://127.0.0.1:7890",  //NOTE: de-annotate this line if proxy required
  oauth: {
    consumer_key: credentials.consumer_key,
    consumer_secret: credentials.consumer_secret,
    token: credentials.access_token_key,
    token_secret: credentials.access_token_secret,
  }
});

// main
const db_path = './db.json';
const result_path = './favs.ndjson';

(async () => {
  const db = new Set(fs.existsSync(db_path) ? JSON.parse(fs.readFileSync(db_path)) : void 0);
  const favs = fs.createWriteStream(result_path, {flags:'a'});

  let counter = 0;
  for await (const status of cursorAllFavs()) {
    console.info(++counter);
    if(!db.has(status.id_str)) {
      db.add(status.id_str);
      favs.write(JSON.stringify(status));
      favs.write("\n");
    } else console.info(`${status.id_str} exists in db`);
  }

  favs.end(() => {
    fs.writeFileSync(db_path, JSON.stringify(Array.from(db)));
    console.info("Done.");
    process.exit(0)
  })
})()

// functions

//NOTE: https://github.com/tweepy/tweepy/blob/8dba191518366fb756440302eff86d5a868e0306/tweepy/cursor.py#L127
async function* cursorAllFavs (max_id) {
  const statuses = await (max_id ? fetchFav({ max_id }) : fetchFav()); // short hand

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
  return new Promise((resolve, reject) => {
    fetch({
      method: "get",
      url: "https://api.twitter.com/1.1/favorites/list.json",
      qs: additionalParams ? {...params, ...additionalParams} : params
    }, (error, response, body) => {
      if(error) return reject(error);
      if(response.statusCode === 200) {
        console.info(`x-rate-limit-remaining: ${response.headers["x-rate-limit-remaining"]}`);
        return resolve(JSON.parse(body));
      } else reject(response);
    })
  })
}

// fetchFav().then(data => fs.writeFileSync("./temp.json", data));