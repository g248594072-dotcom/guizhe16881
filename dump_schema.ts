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

>>>>>>> 5427fc4312cb5983ca9885b5f500c6082deaadf5
fs.globSync('src/**/schema.ts').forEach(async schema_file => {
  try {
    globalThis._ = _;
    globalThis.z = z;
    const module = await import(
<<<<<<< HEAD
      (process.platform === 'win32' ? 'file://' : '') + path.resolve(repoRoot, schema_file)
=======
      (process.platform === 'win32' ? 'file://' : '') + path.resolve(import.meta.dirname, schema_file)
>>>>>>> 5427fc4312cb5983ca9885b5f500c6082deaadf5
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
