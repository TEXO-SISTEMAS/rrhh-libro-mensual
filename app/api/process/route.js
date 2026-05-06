import { NextResponse } from 'next/server';
import { processRRHH } from '@/lib/processExcel';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No se recibió ningún archivo.' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      return NextResponse.json({ error: 'El archivo debe ser .xlsx (DOC RRHH).' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const outputBuffer = await processRRHH(buffer);

    return new NextResponse(outputBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="LIBROS_MENSUALES.xlsx"',
      },
    });
  } catch (error) {
    console.error('[process] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno al procesar el archivo.' },
      { status: 500 }
    );
  }
}
