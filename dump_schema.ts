/* eslint-disable */
// @ts-nocheck
import _ from 'lodash';
import fs from 'node:fs';
import path from 'node:path';
<<<<<<< HEAD
import { fileURLToPath } from 'node:url';
import z from 'zod';

const repoRoot = path.dirname(fileURLToPath(import.meta.url));

=======
import z from 'zod';

>>>>>>> 4e7451805c5655a416233e7632d1b0693b9cade6
fs.globSync('src/**/schema.ts').forEach(async schema_file => {
  try {
    globalThis._ = _;
    globalThis.z = z;
    const module = await import(
<<<<<<< HEAD
      (process.platform === 'win32' ? 'file://' : '') + path.resolve(repoRoot, schema_file)
=======
      (process.platform === 'win32' ? 'file://' : '') + path.resolve(import.meta.dirname, schema_file)
>>>>>>> 4e7451805c5655a416233e7632d1b0693b9cade6
    );
    if (_.has(module, 'Schema')) {
      const schema = _.get(module, 'Schema');
      if (_.isFunction(schema)) {
        schema = schema();
      }
      fs.writeFileSync(
        path.join(path.dirname(schema_file), 'schema.json'),
        JSON.stringify(z.toJSONSchema(schema, { io: 'input', reused: 'ref' }), null, 2),
      );
    }
  } catch (e) {
    console.error(`生成 '${schema_file}' 对应的 schema.json 失败: ${e}`);
  }
});
