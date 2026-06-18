/**
 * Gerador de documentos de entrega .docx — replica o formato dos docs do Sprint 1/2.
 *
 * Cada entrega é definida como um objeto JSON em `definitions/` (arquivo por tarefa).
 * Esse script lê cada um, monta o .docx com seções:
 *   - Capa (título + subtítulo + divisor azul)
 *   - 📖 Em palavras simples
 *   - 1. Identificação (tabela 2 colunas)
 *   - 2. Objetivo
 *   - 3. Critério de aceitação
 *   - 4. Conteúdo da entrega (sub-itens 4.x com texto/tabelas/código)
 *   - 5. Validação
 *   - 6. Dependências e próximos passos
 *
 * Rodar:  node tools/deliverable-docs/build.mjs
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
  BorderStyle,
  LevelFormat,
} from 'docx';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFS_DIR = path.join(__dirname, 'definitions');
const ROOT = path.resolve(__dirname, '..', '..');

const PALETTE = {
  titleBlue: '1F3864',
  subtitleGray: '595959',
  tableBorder: 'B0B0B0',
  tableHeaderBg: 'F0F4F9',
};
const FONT = 'Arial';

// =============================================================
// Helpers de construção de Paragraph / TableCell / etc.
// =============================================================

function titleParagraph(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [
      new TextRun({
        text,
        font: FONT,
        size: 36,
        bold: true,
        color: PALETTE.titleBlue,
      }),
    ],
  });
}

function subtitleParagraph(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 240 },
    children: [
      new TextRun({ text, font: FONT, size: 26, italics: true, color: PALETTE.subtitleGray }),
    ],
  });
}

function dividerParagraph() {
  return new Paragraph({
    spacing: { after: 240 },
    border: {
      bottom: { color: PALETTE.titleBlue, space: 1, style: BorderStyle.SINGLE, size: 8 },
    },
    children: [new TextRun({ text: '' })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 360, after: 180 },
    children: [
      new TextRun({ text, font: FONT, size: 28, bold: true, color: PALETTE.titleBlue }),
    ],
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 240, after: 120 },
    children: [
      new TextRun({ text, font: FONT, size: 24, bold: true, color: PALETTE.titleBlue }),
    ],
  });
}

function body(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 180 },
    children: [new TextRun({ text, font: FONT, size: 22, ...opts })],
  });
}

function bullet(text) {
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { after: 80 },
    children: [new TextRun({ text, font: FONT, size: 22 })],
  });
}

function codeBlock(code) {
  const lines = code.split('\n');
  return lines.map(
    (line, i) =>
      new Paragraph({
        spacing: { after: i === lines.length - 1 ? 180 : 40 },
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F4F6FA' },
        children: [
          new TextRun({
            text: line || ' ',
            font: 'Consolas',
            size: 20,
          }),
        ],
      }),
  );
}

function cellBorder() {
  return {
    top: { style: BorderStyle.SINGLE, color: PALETTE.tableBorder, size: 4 },
    left: { style: BorderStyle.SINGLE, color: PALETTE.tableBorder, size: 4 },
    bottom: { style: BorderStyle.SINGLE, color: PALETTE.tableBorder, size: 4 },
    right: { style: BorderStyle.SINGLE, color: PALETTE.tableBorder, size: 4 },
  };
}

function tableCell(text, opts = {}) {
  const { bold = false, width, isHeader = false, fillColor } = opts;
  return new TableCell({
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    borders: cellBorder(),
    shading: {
      fill: fillColor ?? (isHeader ? PALETTE.tableHeaderBg : 'FFFFFF'),
      type: ShadingType.CLEAR,
      color: 'auto',
    },
    margins: { top: 100, bottom: 100, left: 140, right: 140 },
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            font: FONT,
            size: 20,
            bold: bold || isHeader,
          }),
        ],
      }),
    ],
  });
}

function identificationTable(fields) {
  const rows = fields.map(
    ([label, value]) =>
      new TableRow({
        children: [
          tableCell(label, { bold: true, width: 3360 }),
          tableCell(value, { width: 6000 }),
        ],
      }),
  );
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [3360, 6000],
    rows,
  });
}

function dataTable({ headers, rows, columnWidths }) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) =>
      tableCell(h, { isHeader: true, width: columnWidths[i] }),
    ),
  });
  const dataRows = rows.map(
    (r) =>
      new TableRow({
        children: r.map((cell, i) =>
          tableCell(String(cell), { width: columnWidths[i] }),
        ),
      }),
  );
  return new Table({
    width: { size: columnWidths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths,
    rows: [headerRow, ...dataRows],
  });
}

// =============================================================
// Render por seção (a partir do def)
// =============================================================

function renderEmPalavrasSimples(paragraphs) {
  return [h2('📖 Em palavras simples'), ...paragraphs.map((p) => body(p))];
}

function renderIdentificacao(fields) {
  return [h2('1. Identificação'), identificationTable(fields), new Paragraph({ spacing: { after: 180 }, children: [] })];
}

function renderObjetivo(text) {
  return [h2('2. Objetivo'), ...text.split('\n\n').map((p) => body(p))];
}

function renderCriterio(text) {
  return [h2('3. Critério de aceitação'), ...text.split('\n\n').map((p) => body(p))];
}

function renderConteudoBlock(block) {
  // block = { type: 'h3'|'body'|'bullets'|'table'|'code', ... }
  switch (block.type) {
    case 'h3':
      return [h3(block.text)];
    case 'body':
      return block.text.split('\n\n').map((p) => body(p));
    case 'bullets':
      return block.items.map((it) => bullet(it));
    case 'table':
      return [dataTable(block)];
    case 'code':
      return codeBlock(block.code);
    default:
      return [];
  }
}

function renderConteudo(blocks) {
  return [h2('4. Conteúdo da entrega'), ...blocks.flatMap(renderConteudoBlock)];
}

function renderValidacao(items) {
  return [h2('5. Validação'), ...items.map((it) => bullet(it))];
}

function renderDependencias(text, items) {
  const out = [h2('6. Dependências e próximos passos')];
  if (text) out.push(body(text));
  if (items?.length) out.push(...items.map((it) => bullet(it)));
  return out;
}

// =============================================================
// Build do documento
// =============================================================

function buildDoc(def) {
  const children = [
    titleParagraph(def.title),
    subtitleParagraph(def.subtitle),
    dividerParagraph(),
    ...renderEmPalavrasSimples(def.emPalavrasSimples),
    ...renderIdentificacao(def.identificacao),
    ...renderObjetivo(def.objetivo),
    ...renderCriterio(def.criterio),
    ...renderConteudo(def.conteudo),
    ...renderValidacao(def.validacao),
    ...renderDependencias(def.dependencias.texto, def.dependencias.proximos),
  ];

  return new Document({
    creator: 'PSP2 IA Universitários',
    title: def.title,
    description: def.subtitle,
    styles: {
      default: {
        document: { run: { font: FONT, size: 22 } },
      },
      paragraphStyles: [
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font: FONT, size: 36, bold: true, color: PALETTE.titleBlue },
          paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 0 },
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font: FONT, size: 28, bold: true, color: PALETTE.titleBlue },
          paragraph: { spacing: { before: 360, after: 180 }, outlineLevel: 1 },
        },
        {
          id: 'Heading3',
          name: 'Heading 3',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font: FONT, size: 24, bold: true, color: PALETTE.titleBlue },
          paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 2 },
        },
      ],
    },
    numbering: {
      config: [
        {
          reference: 'bullets',
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '•',
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: { indent: { left: 720, hanging: 360 } },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children,
      },
    ],
  });
}

// =============================================================
// Main
// =============================================================

async function main() {
  const defs = await fs.readdir(DEFS_DIR);
  for (const file of defs) {
    if (!file.endsWith('.mjs')) continue;
    const def = (await import(path.join(DEFS_DIR, file))).default;
    if (!def?.output) {
      console.warn(`Skipping ${file}: sem output path`);
      continue;
    }
    const doc = buildDoc(def);
    const buffer = await Packer.toBuffer(doc);
    const out = path.join(ROOT, def.output);
    await fs.mkdir(path.dirname(out), { recursive: true });
    await fs.writeFile(out, buffer);
    console.log(`✓ ${path.relative(ROOT, out)}`);
  }
}

// Exporta o builder para reuso por outros runners (ex: sprints345/build.mjs),
// preservando o mesmo formato dos docs de entrega.
export { buildDoc };

// Só roda o main quando este arquivo é o entrypoint (node build.mjs).
// Importá-lo de outro módulo não dispara a geração dos 9 docs antigos.
const isEntrypoint =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntrypoint) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
