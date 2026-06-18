/**
 * Runner dos docs de entrega das Sprints 3, 4 e 5 (reformulação retroativa).
 *
 * Reaproveita o buildDoc() de ../build.mjs (mesmo formato dos docs das Sprints 1/2):
 *   Capa → 📖 Em palavras simples → 1. Identificação → 2. Objetivo →
 *   3. Critério de aceitação → 4. Conteúdo da entrega → 5. Validação →
 *   6. Dependências e próximos passos.
 *
 * Cada definição vive em defs-sprintN.mjs (array de objetos no mesmo schema do
 * gerador original). Rodar:  node tools/deliverable-docs/sprints345/build.mjs
 */

import { Packer } from 'docx';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDoc } from '../build.mjs';
import sprint3 from './defs-sprint3.mjs';
import sprint4 from './defs-sprint4.mjs';
import sprint5 from './defs-sprint5.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', '..');

const defs = [...sprint3, ...sprint4, ...sprint5];

async function main() {
  let ok = 0;
  for (const def of defs) {
    if (!def?.output) {
      console.warn(`Skipping (sem output): ${def?.title ?? '??'}`);
      continue;
    }
    const doc = buildDoc(def);
    const buffer = await Packer.toBuffer(doc);
    const out = path.join(ROOT, def.output);
    await fs.mkdir(path.dirname(out), { recursive: true });
    await fs.writeFile(out, buffer);
    console.log(`✓ ${path.relative(ROOT, out)}`);
    ok++;
  }
  console.log(`\n${ok}/${defs.length} docs gerados.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
