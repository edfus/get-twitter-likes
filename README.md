# Get-twitter-likes

## Features

- No dependency.
- Built-in https proxy support for accessing twitter's endpoints.
- Perform a Ctrl + C exit at whatever time without concerning about data corruption | async operations hanging process.
- Automatic retry when connection interrupted.
- Respect `X-Rate-Limit` in response headers instead of inelegant fixed-window throttling.

## Prerequisites

- Have an application created at apps.twitter.com <https://developer.twitter.com/en/apps>.
- [Node.js](https://nodejs.org/en/) & npm installed on your machine.

You should also make sure the top *5* Tweets in your `https://twitter.com/YOURUSERNAME/likes` timeline is up to date (e.g. not liking a Tweet from 2010 right before running this script).

(The reason why, if you are wondering, is sequential ids are not assigned to favs, but to the original statuses and we are relying on the minimum one of that in each fetched group for performing a hacky iteration using the `max_id` query parameter)

## Intallation

```bash
git clone --depth 1 https://github.com/edfus/get-twitter-likes
cd  get-twitter-likes
npm install --only=production
```

Your Node.js version should be equal to or higher than 13 (async generator: 10.3.0, module import: 13).

Create `creds.mjs` (or just rename `creds-template.mjs` to `creds.mjs`) and put tokens you got from your twitter application into it in the following way:

```js
export default {
  username: "yourusername", // more precisely, the @screen_name of anyone you can access. (public accounts or protected accounts that you are following)
  consumer_key: "",
  consumer_secret: "",
  access_token_key: "",
  access_token_secret: ""
}
```

## Usage

```bash
npm run get

`
  command line arguments:
  --proxy=http://YOURPROXY:PORT
  --output="./PREFERED_OUTPUTPATH" - default to "./" (pwd)
  --smart-exit                     - auto exit when found 20 favs having been fetched before
`
```

Two files will be produced in the output directory:
  - favs.db.csv - a database storing fetched ids for avoiding duplications.
  - favs.ndjson - all your favs's info in [ndjson](http://ndjson.org/) format.

BTW, if you wanna download all media out from the `favs.ndjson` file, take a look at my [download-twitter-likes](https://github.com/edfus/download-twitter-likes) package.

```bash
#!/bin/bash

# Absolute path this script is in
__dirname=$(dirname "$(readlink -f "$0")")

readonly path=/YOUR/PATH/TO/PACKAGES
readonly proxy='--proxy=http://127.0.0.1:7890'

cd "${path}/get-twitter-likes"
npm run get -- --smart-exit --output="${__dirname}/" "${proxy}"
cd "${path}/download-twitter-likes"
npm run download -- "--path=${__dirname}/" "--output-folder=${__dirname}/Raw/" "${proxy}"

read -p 'Press any key to exit...'
```