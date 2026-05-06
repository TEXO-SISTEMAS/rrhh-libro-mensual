import XLSX from 'xlsx';
import XlsxPopulate from 'xlsx-populate';
import path from 'path';

// ── Conceptos ─────────────────────────────────────────────────────────────────
const SALARY_CONCEPT         = 77;
const AGUINALDO_CONCEPT      = 4;
const BONIF_FAMILIAR_CONCEPT = 7;
const SKIP_CONCEPTS          = new Set([679, 680]);

// ── Filas (1-based) ───────────────────────────────────────────────────────────
// Row 16: encabezados de columnas
// Row 17: encabezado de días (1-31 en cols 7-37)
// Rows 18-35: 18 empleados pre-cargados en el template
// Row 36: fila TOTAL
const START_ROW = 18;

// ── Columnas (1-based, verificadas leyendo el MODELO real) ───────────────────
const COL = {
  NRO:       3,   // C
  NOMBRE:    5,   // E
  CEDULA:    6,   // F
  // cols 7-37 = días 1-31 → NO ESCRIBIR
  FP:        38,  // AL
  UNITARIO:  39,  // AM
  DIAS:      40,  // AN
  HORAS:     41,  // AO
  SALARIO:   42,  // AP
  // 43-46: HE y Vacaciones → NO ESCRIBIR
  BONIF_FAM: 47,  // AU
  AGUINALDO: 48,  // AV
  OTROS:     49,  // AW
  TOTAL:     50,  // AX
};

const COL_START = 3;   // primera columna a limpiar/copiar (C)
const COL_END   = 50;  // última columna a limpiar/copiar (AX)

// Propiedades de estilo que se copian al duplicar filas
const STYLE_PROPS = [
  'bold', 'italic', 'underline', 'strikethrough',
  'fontSize', 'fontFamily', 'fontColor',
  'horizontalAlignment', 'verticalAlignment', 'wrapText',
  'fill', 'border', 'numberFormat',
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function getConceptCode(concepto) {
  const match = String(concepto).trim().match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function normalizeCi(ci) {
  return String(ci).trim().replace(/[\s.\-]/g, '');
}

// Guarda el contenido y estilos de una fila completa
function snapshotRow(sheet, row) {
  const cells = [];
  for (let c = COL_START; c <= COL_END; c++) {
    const cell     = sheet.cell(row, c);
    const snapshot = { col: c, value: cell.value(), styles: {} };
    for (const s of STYLE_PROPS) {
      try { snapshot.styles[s] = cell.style(s); } catch (_) {}
    }
    cells.push(snapshot);
  }
  return { cells, height: sheet.row(row).height() };
}

// Escribe el contenido y estilos guardados en una fila destino
function restoreRow(sheet, { cells, height }, targetRow) {
  if (height) sheet.row(targetRow).height(height);
  for (const { col, value, styles } of cells) {
    const cell = sheet.cell(targetRow, col);
    cell.value(value ?? null);
    for (const [s, v] of Object.entries(styles)) {
      if (v !== undefined && v !== null) {
        try { cell.style(s, v); } catch (_) {}
      }
    }
  }
}

// Copia estilos de una fila fuente a una fila destino (sin copiar valores)
function copyRowStyles(sheet, sourceRow, targetRow) {
  const h = sheet.row(sourceRow).height();
  if (h) sheet.row(targetRow).height(h);
  for (let c = COL_START; c <= COL_END; c++) {
    const src = sheet.cell(sourceRow, c);
    const tgt = sheet.cell(targetRow, c);
    for (const s of STYLE_PROPS) {
      try {
        const v = src.style(s);
        if (v !== undefined && v !== null) tgt.style(s, v);
      } catch (_) {}
    }
  }
}

// ── Proceso principal ─────────────────────────────────────────────────────────
export async function processRRHH(inputBuffer) {

  // 1. Parsear el DOC RRHH fuente ─────────────────────────────────────────────
  const wb      = XLSX.read(inputBuffer, { type: 'buffer' });
  const ws      = wb.Sheets[wb.SheetNames[0]];
  const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  const employees     = new Map();
  const employeeOrder = [];

  for (let i = 1; i < rawData.length; i++) {
    const row    = rawData[i];
    const nombre = String(row[0]).trim();
    const ciRaw  = String(row[1]).trim();
    const ciKey  = normalizeCi(ciRaw);
    if (!ciKey) continue;

    const code    = getConceptCode(row[2]);
    const importe = parseFloat(row[3]) || 0;

    if (!employees.has(ciKey)) {
      employees.set(ciKey, { nombre, ci: ciRaw, salario: 0, aguinaldo: 0, bonifFamiliar: 0, otrosBeneficios: 0 });
      employeeOrder.push(ciKey);
    }

    const emp = employees.get(ciKey);
    if      (SKIP_CONCEPTS.has(code))              { /* ignorar */ }
    else if (code === SALARY_CONCEPT)               emp.salario          = importe;
    else if (code === AGUINALDO_CONCEPT)            emp.aguinaldo       += importe;
    else if (code === BONIF_FAMILIAR_CONCEPT)       emp.bonifFamiliar   += importe;
    else                                            emp.otrosBeneficios += importe;
  }

  // Excluir empleados sin ningún importe (solo tenían 679/680)
  const included = employeeOrder.filter(k => {
    const e = employees.get(k);
    return (e.salario + e.aguinaldo + e.bonifFamiliar + e.otrosBeneficios) > 0;
  });

  if (included.length === 0) throw new Error('No se encontraron empleados válidos en el archivo.');

  // 2. Abrir el MODELO ─────────────────────────────────────────────────────────
  const templatePath = path.join(process.cwd(), 'template', 'MODELO_LIBROS_MENSUALES_AMPLIFY.xlsx');
  const workbook = await XlsxPopulate.fromFileAsync(templatePath);
  const sheet    = workbook.sheet(0);

  // 3. Localizar la fila TOTAL en el template ──────────────────────────────────
  let totalRow = null;
  for (let r = START_ROW; r <= START_ROW + 100; r++) {
    const vB = sheet.cell(r, COL.NRO).value();
    const vC = sheet.cell(r, COL.NOMBRE).value();
    if ((vB && String(vB).toUpperCase().includes('TOTAL')) ||
        (vC && String(vC).toUpperCase().includes('TOTAL'))) {
      totalRow = r;
      break;
    }
  }
  if (!totalRow) throw new Error('No se encontró la fila TOTAL en el template.');

  const lastTemplateDataRow = totalRow - 1; // última fila pre-formateada (row 35)
  const newTotalRow         = START_ROW + included.length; // donde quedará TOTAL

  // 4. Guardar la fila TOTAL antes de limpiar ──────────────────────────────────
  const totalSnapshot  = snapshotRow(sheet, totalRow);
  const totalRowHeight = sheet.row(totalRow).height();

  // 5. Quitar el merge ANCHO del TOTAL original (C:E = cols 3-5) ───────────────
  //    Si no se quita, col E queda cubierta por ese merge y no acepta valores.
  try { sheet.range(totalRow, 3, totalRow, 5).merged(false); } catch (_) {}

  // 6. Limpiar el rango de datos ────────────────────────────────────────────────
  const clearEnd = Math.max(totalRow, START_ROW + included.length - 1);
  for (let r = START_ROW; r <= clearEnd; r++) {
    for (let c = COL_START; c <= COL_END; c++) {
      sheet.cell(r, c).value(null);
    }
  }

  // 7. Para filas extra (más allá del template): copiar estilos + merge C:D ────
  for (let r = lastTemplateDataRow + 1; r < newTotalRow; r++) {
    copyRowStyles(sheet, lastTemplateDataRow, r);
    try { sheet.range(r, 3, r, 4).merged(true); } catch (_) {}   // merge C:D igual que filas template
  }

  // 8. Preparar el merge de la nueva fila TOTAL (C:E, más ancho) ───────────────
  try { sheet.range(newTotalRow, 3, newTotalRow, 4).merged(false); } catch (_) {} // quitar C:D si existe
  try { sheet.range(newTotalRow, 3, newTotalRow, 5).merged(true);  } catch (_) {} // agregar C:E

  // 9. Escribir los nuevos empleados ───────────────────────────────────────────
  included.forEach((ciKey, idx) => {
    const emp = employees.get(ciKey);
    const row = START_ROW + idx;

    const importeUnitario = emp.salario > 0 ? Math.round(emp.salario / 30) : 0;
    const totalGeneral    = emp.salario + emp.aguinaldo + emp.bonifFamiliar + emp.otrosBeneficios;

    sheet.cell(row, COL.NRO).value(idx + 1);
    sheet.cell(row, COL.NOMBRE).value(emp.nombre);
    sheet.cell(row, COL.CEDULA).value(emp.ci);
    sheet.cell(row, COL.FP).value('MENSUAL');
    sheet.cell(row, COL.UNITARIO).value(importeUnitario);
    sheet.cell(row, COL.DIAS).value(22);
    sheet.cell(row, COL.HORAS).value(198);
    sheet.cell(row, COL.SALARIO).value(emp.salario);

    if (emp.bonifFamiliar   > 0) sheet.cell(row, COL.BONIF_FAM).value(emp.bonifFamiliar);
    if (emp.aguinaldo       > 0) sheet.cell(row, COL.AGUINALDO).value(emp.aguinaldo);
    if (emp.otrosBeneficios > 0) sheet.cell(row, COL.OTROS).value(emp.otrosBeneficios);

    sheet.cell(row, COL.TOTAL).value(totalGeneral);
  });

  // 10. Restaurar la fila TOTAL al final ───────────────────────────────────────
  if (totalRowHeight) sheet.row(newTotalRow).height(totalRowHeight);
  restoreRow(sheet, totalSnapshot, newTotalRow);

  return { buffer: await workbook.outputAsync(), count: included.length };
}
