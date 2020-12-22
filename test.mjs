import SetDB from "./set-db.mjs"
import fs from "fs"
import { Readable } from "stream"

const path = "./test-db.csv";

let i = 0;
new Readable({
  read (size = 1) {
    for (let j = 0; j < size; j++) {
      this.push(`${i++},`);
    }
    if(i > 1000000) this.push(null);
  }
}).pipe(fs.createWriteStream(path))
  .on("finish", async () => {
    const db = new SetDB(path);
    await db.loaded;
    for (let j = 0; j < i + 5; j++) {
      if(!db.has(String(j))) 
        console.log(`!db.has(${j})`)
    }
  })