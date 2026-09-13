const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const bytes = fs.readFileSync(path.join(root, 'dist', 'sight-thief-web.zip'));
const end = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
assert.ok(end >= 0, 'ZIP end record exists');
const count = bytes.readUInt16LE(end + 10), files = [];
let cursor = bytes.readUInt32LE(end + 16);
for (let index = 0; index < count; index++) {
  assert.equal(bytes.readUInt32LE(cursor), 0x02014b50);
  const method = bytes.readUInt16LE(cursor + 10), compressedSize = bytes.readUInt32LE(cursor + 20), size = bytes.readUInt32LE(cursor + 24);
  const nameSize = bytes.readUInt16LE(cursor + 28), extraSize = bytes.readUInt16LE(cursor + 30), commentSize = bytes.readUInt16LE(cursor + 32), offset = bytes.readUInt32LE(cursor + 42);
  const name = bytes.subarray(cursor + 46, cursor + 46 + nameSize).toString('utf8');
  assert.ok(!name.includes('\\') && !name.includes('..') && !name.startsWith('/'), `portable relative path: ${name}`);
  assert.equal(bytes.readUInt32LE(offset), 0x04034b50);
  const start = offset + 30 + bytes.readUInt16LE(offset + 26) + bytes.readUInt16LE(offset + 28), compressed = bytes.subarray(start, start + compressedSize);
  const content = method === 8 ? zlib.inflateRawSync(compressed) : compressed;
  assert.equal(content.length, size);
  const hash = value => createHash('sha256').update(value).digest('hex');
  const sha256 = hash(content); assert.equal(sha256, hash(fs.readFileSync(path.join(root, name))), `ZIP entry matches built source: ${name}`);
  files.push({ name, size, sha256 }); cursor += 46 + nameSize + extraSize + commentSize;
}
assert.deepEqual(files.map(file => file.name).sort(), ['.nojekyll', 'assets/key-art.webp', 'assets/paintings.webp', 'assets/favicon.svg', 'licenses/three.txt', 'game.js', 'index.html', 'style.css'].sort());
const report = { bytes: bytes.length, entries: count, files };
fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true }); fs.writeFileSync(path.join(root, 'artifacts', 'package-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
