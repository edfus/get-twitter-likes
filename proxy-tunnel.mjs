import { request as request_http } from "http";
import { request as request_https } from "https";

const http_connect = request_http;

async function fetch(url, options) {
  const uriObject = url instanceof URL ? url : new URL(url);
  return new Promise((resolve, reject) => {
    http_connect(
      options.proxy,
      {
        method: "CONNECT",
        path: constructHost(uriObject),
        headers: {
          "Proxy-Authorization": `Basic ${Buffer.from(`${"username"}":"${"password"}`).toString("base64")}`
        },
      }
    )
      .once("connect", (response, socket) => {
        if (response.statusCode === 200) { // connected to proxy server
          const request = uriObject.protocol === "https:"
                          ? request_https
                          : request_http
                          ;

          request (
            uriObject,
            {
              method: options.method || "GET",
              socket: socket,
              agent: false,
              headers: options.headers
            }
          )
            .once("response", resolve)
            .once("error", reject)
            .end();
        } else {
          return reject(
            `connecting to proxy ${options.proxy} failed with ${response.statusCode} ${response.statusMessage}`
          );
        }
      })
      .once("error", reject)
      .end();
  })
}

function constructHost(uriObject) {
  let port = uriObject.port;

  if (!port) {
    if (uriObject.protocol === "https:") {
      port = "443"
    } else {
      port = "80"
    }
  }

  return `${uriObject.hostname}:${port}`;
}

export { fetch };