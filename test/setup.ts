import * as fs from 'fs';
import * as path from 'path';


export function mkTmpGuidance(name = 'guidance-fixture'): string {
    const base = fs.mkdtempSync(path.join(process.cwd(), `${name}-`));
    const g = path.join(base, '.guidance');
    fs.mkdirSync(g);
    fs.mkdirSync(path.join(g, 'kernels'));
    return g;
}


export function write(p: string, content: string) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
}