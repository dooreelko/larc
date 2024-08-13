import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url'

const filenameNew = fileURLToPath(import.meta.url)

export const jsBundle = () => fs.readFileSync(path.join(path.dirname(filenameNew), 'leader-line.min.js'), 'utf-8');
