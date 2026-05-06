'use client';

import { useState, useRef } from 'react';
import styles from './page.module.css';

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function Home() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [downloadBlob, setDownloadBlob] = useState(null);
  const [downloadName, setDownloadName] = useState('');
  const [employeeCount, setEmployeeCount] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef();

  const resetDownload = () => {
    setDownloadBlob(null);
    setDownloadName('');
    setEmployeeCount(0);
    setProgress(0);
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.xlsx')) {
      setError('El archivo debe tener formato .xlsx');
      setFile(null);
      return;
    }
    setFile(f);
    setError('');
    resetDownload();
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.xlsx')) {
      setError('El archivo debe tener formato .xlsx');
      return;
    }
    setFile(f);
    setError('');
    resetDownload();
  };

  const handleDownload = async () => {
    if (!downloadBlob) return;
    if (typeof window !== 'undefined' && window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: downloadName,
          types: [{
            description: 'Excel Workbook',
            accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(downloadBlob);
        await writable.close();
        return;
      } catch (e) {
        if (e.name === 'AbortError') return;
      }
    }
    const url = URL.createObjectURL(downloadBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleProcess = async () => {
    if (!file || loading) return;
    setLoading(true);
    setError('');
    resetDownload();

    let p = 0;
    const interval = setInterval(() => {
      p += Math.random() * 12 + 3;
      if (p > 85) p = 85;
      setProgress(Math.round(p));
    }, 250);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/process', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `Error HTTP ${res.status}` }));
        throw new Error(data.error || `Error al procesar (${res.status})`);
      }

      clearInterval(interval);
      setProgress(100);

      const count = parseInt(res.headers.get('X-Employee-Count') || '0', 10);
      const blob = await res.blob();
      const baseName = file.name.replace(/\.xlsx$/i, '');
      setDownloadBlob(blob);
      setDownloadName(`${baseName}_LIBROS_MENSUALES.xlsx`);
      setEmployeeCount(count);
    } catch (err) {
      clearInterval(interval);
      setProgress(0);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`${styles.wrapper} ${styles.dark}`}>
      <main className={styles.main}>
        <div className={styles.container}>
          <img
            src="/logo-texo.png"
            alt="TEXO Sistemas"
            className={styles.logoImg}
          />

          <div className={styles.card}>
            <div
              className={`${styles.dropzone} ${dragOver ? styles.dropzoneActive : ''}`}
              onClick={() => inputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              {file ? (
                <>
                  <div className={styles.dropIcon}>📄</div>
                  <p className={styles.fileName}>{file.name}</p>
                  <p className={styles.fileSize}>{formatBytes(file.size)}</p>
                </>
              ) : (
                <>
                  <div className={styles.dropIcon}>{dragOver ? '📂' : '⬆️'}</div>
                  <p className={styles.dropText}>{dragOver ? 'Soltar archivo aquí' : 'Haga clic para seleccionar'}</p>
                  <p className={styles.dropHint}>Archivo DOC RRHH (.xlsx)</p>
                </>
              )}
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <button
              className={styles.button}
              onClick={handleProcess}
              disabled={!file || loading}
            >
              {loading && <span className={styles.spinner} />}
              {loading ? 'Procesando...' : 'Generar Libro Mensual'}
            </button>

            {loading && (
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${progress}%` }} />
              </div>
            )}

            {downloadBlob && (
              <>
                <div className={styles.successMsg}>
                  ✓ {employeeCount} empleado{employeeCount !== 1 ? 's' : ''} procesado{employeeCount !== 1 ? 's' : ''} correctamente
                </div>
                <button onClick={handleDownload} className={styles.downloadLink}>
                  ⬇️ Descargar resultado — {employeeCount} empleado{employeeCount !== 1 ? 's' : ''}
                </button>
              </>
            )}

            <div className={styles.instructions}>
              <h3>Conceptos mapeados</h3>
              <ul>
                <li>77 Salario → Importe (unitario = salario ÷ 30)</li>
                <li>4 Aguinaldo → Aguinaldo</li>
                <li>7 Bonificación Familiar → Bonif. Familiar</li>
                <li>Otros conceptos → Otros Beneficios</li>
                <li>679 Hon. Profesionales / 680 IVA → excluidos</li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      <footer className={styles.footer}>
        Danilo Sosa &nbsp;|&nbsp; TEXO Sistemas
      </footer>
    </div>
  );
}
