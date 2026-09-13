const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const names = ['index.html', 'style.css', 'game.js', 'assets', 'licenses', '.nojekyll'];
for (const name of names) if (!fs.existsSync(path.join(root, name))) throw new Error(`Missing package input: ${name}`);
const output = path.join(root, 'dist', 'sight-thief-web.zip');
fs.mkdirSync(path.dirname(output), { recursive: true });
if (process.platform === 'win32') {
  const quote = value => "'" + value.replace(/'/g, "''") + "'";
  const files = [];
  function collect(relative) {
    if (fs.statSync(path.join(root, relative)).isDirectory()) for (const name of fs.readdirSync(path.join(root, relative))) collect(`${relative}/${name}`);
    else files.push(relative);
  }
  names.forEach(collect);
  const entries = files.map(name => `[IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,${quote(path.join(root, name))},${quote(name)},[IO.Compression.CompressionLevel]::Optimal) | Out-Null`).join(';');
  const script = "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.IO.Compression,System.IO.Compression.FileSystem; $archiveStream=[IO.File]::Open(" + quote(output) + ",[IO.FileMode]::Create); $archive=[IO.Compression.ZipArchive]::new($archiveStream,[IO.Compression.ZipArchiveMode]::Create); try {" + entries + '} finally {$archive.Dispose(); $archiveStream.Dispose()}';
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { stdio: 'inherit' });
} else execFileSync('zip', ['-q', '-r', output, ...names], { cwd: root, stdio: 'inherit' });
console.log(output);
