# Get-twitter-likes

**A Node.js script to fetch a list of Tweets you liked via Twitter's api**

---

## Features

- Using max_id when calling the [favourites api](https://developer.twitter.com/en/docs/twitter-api/v1/tweets/post-and-engage/api-reference/get-favorites-list) to scrape the whole list of your favorite tweets
- You should make sure the top *5* Tweets in your https://twitter.com/YOURUSERNAME/likes timeline is up to date (e.g. not liking a Tweet from 2010 right before running this script)

## Intallation

##### 1. Download

Using git:

```bash
git clone https://github.com/edfus/get-twitter-likes
cd  get-twitter-likes
```

or download manually via <https://github.com/edfus/get-twitter-likes/archive/master.zip>

##### 2. Install

Make sure you have [Node.js](https://nodejs.org/en/) & npm installed on your machine before proceeding.

```bash
# in get-twitter-likes folder
npm install
```

Node.js version equal to or higher than 13 supported. (async generator: 10.3.0, module import: 13)

##### 3. Create an application at apps.twitter.com

URL: <https://developer.twitter.com/en/apps>

##### 4. Create creds.mjs in the directory. Put keys from your application

with file content as following

```js
export default {
  username: "yourusername", // more precisely, the @screen_name of anyone you can access. (public accounts or protected accounts that you are following)
  consumer_key: "",
  consumer_secret: "",
  access_token_key: "",
  access_token_secret: ""
}
```

you can just rename `creds-template.mjs` to `creds.mjs` and put them.

##### 5. Run

```bash
npm run get
```

##### 6. Get the results in `favs.ndjson`

## If proxy required

de-annotate `proxy: "http://127.0.0.1:7890"` in `index.mjs`

Don't forget to modify the `http://127.0.0.1:7890` part to meet your proxy configuration!