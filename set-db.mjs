import fs from "fs";

class SetDB extends Set {
  file = null
  constructor (path) {
    super();

    if(fs.existsSync(path)) {
      let buffer = '';
      this.loaded = new Promise((resolve, reject) => {
        fs.createReadStream(path)
            .setEncoding('utf8')
            .on("end", resolve)
            .on("error", reject)
            .on("data", str => {
              const values = str.split(",");
              buffer = buffer.concat(values[0]);
              if(values.length === 1) // without comma
                return ;
              super.add(buffer);
              for (let i = 1; i < values.length - 1; i++) {
                super.add(values[i]);
              }
              buffer = values[values.length - 1];
            })
      })
    }

    this.file = fs.createWriteStream(path, {flags: "a"})
  }

  add (item) {
    this.file.write(`${item},`);
    return super.add(item);
  }
}

export default SetDB;