import { request as http_connect } from "http";
import { request as request_https } from "https";

async function fetch(url, options) {
  const uriObject = url instanceof URL ? url : new URL(url);
  if(uriObject.protocol !== "https:")
    throw `${url}.protocol !== https:`;
  return new Promise((resolve, reject) => {
    http_connect(
      options.proxy,
      {
        method: "CONNECT",
        path: uriObject.hostname.concat(uriObject.port || ":443"),
        headers: {
          "Proxy-Authorization": `Basic ${Buffer.from(`${"username"}":"${"password"}`).toString("base64")}`
        },
      }
    )
      .once("connect", (response, socket) => {
        if (response.statusCode === 200) {
          request_https (
            uriObject,
            {
              method: options.method || "GET",
              socket: socket,
              agent: false,
              headers: options.headers
            }
          )
            .once("response", resolve)
            .once("error", err => {
              socket.destroy();
              return reject(err);
            })
            .end();
        } else {
          socket.destroy();
          return reject(
            `connecting to proxy ${options.proxy} failed with ${response.statusCode} ${response.statusMessage}`
          );
        }
      })
      .once("error", reject)
      .end();
  })
}

export { fetch };