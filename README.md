# Get-twitter-likes

**A Node.js script to fetch the whole list of Tweets you liked via Twitter's api**

---

## Features

- No dependency, extremely lightweight.
- Built-in https proxy support for accessing twitter's endpoint.
- Perform a Ctrl + C exit at whatever time without concerning about data corruption | async operations hanging process.
- Automatic retry when connection interrupted.
- Respect twitter's `x-rate-limit` response header instead of inelegant fixed-window throttling.

## Prerequisites

- Created an application at apps.twitter.com <https://developer.twitter.com/en/apps>.
- [Node.js](https://nodejs.org/en/) & npm installed on your machine.

You should also make sure the top *5* Tweets in your `https://twitter.com/YOURUSERNAME/likes` timeline is up to date (e.g. not liking a Tweet from 2010 right before running this script).

(The reason why, if you are wondering, is sequential ids are not assigned to favs, but to the original statuses and we are relying on the minimum one of that in each fetched group for performing a hacky iteration using `max_id` param)

## Intallation

```bash
git clone --depth 1 https://github.com/edfus/get-twitter-likes
cd  get-twitter-likes
npm install --only=production
```

Node.js version should be equal to or higher than 13 (async generator: 10.3.0, module import: 13)

Then create `creds.mjs` (or just rename `creds-template.mjs` to `creds.mjs`) in the directory. Put tokens you got from your twitter application like following:

```js
export default {
  username: "yourusername", // more precisely, the @screen_name of anyone you can access. (public accounts or protected accounts that you are following)
  consumer_key: "",
  consumer_secret: "",
  access_token_key: "",
  access_token_secret: ""
}
```

## Execute

```bash
npm run get

`
  command line arguments:
  --proxy=http://YOURPROXY:PORT
  --output="./PREFERED_OUTPUTPATH" - default to "./" (pwd)
  --smart-exit                     - auto exit when found 20 favs having been fetched before
`
```

This will result in two files created in output folder:
  - favs.db.csv - the database storing fetched ids to avoid duplication
  - favs.ndjson - all your favs's info in [ndjson](http://ndjson.org/) format

Alternatively, if you wanna download all media out from the `favs.ndjson` file, take a look at my [download-twitter-likes](https://github.com/edfus/download-twitter-likes) package.

```bash
#! /bin/bash

# Absolute path this script is in
__dirname=$(dirname "$(readlink -f "$0")")

readonly path=/YOUR/PATH/TO/PACKAGES
readonly proxy="--proxy=http://127.0.0.1:7890"

cd ${path}/get-twitter-likes
npm run get -- --smart-exit --output=${__dirname}/ ${proxy}
cd ${path}/download-twitter-likes
npm run download -- --path=${__dirname}/ --folder=Raw/ ${proxy}

read -p $'\n'
```