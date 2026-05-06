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
  const [downloadUrl, setDownloadUrl] = useState('');
  const [downloadName, setDownloadName] = useState('');
  const inputRef = useRef();

  const resetDownload = () => {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setDownloadUrl('');
    setDownloadName('');
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

  const handleDrop = (e) => {
    e.preventDefault();
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

  const handleProcess = async () => {
    if (!file || loading) return;
    setLoading(true);
    setError('');
    resetDownload();

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

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const baseName = file.name.replace(/\.xlsx$/i, '');
      setDownloadUrl(url);
      setDownloadName(`${baseName}_LIBROS_MENSUALES.xlsx`);
    } catch (err) {
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
              className={styles.dropzone}
              onClick={() => inputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
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
                  <div className={styles.dropIcon}>⬆️</div>
                  <p className={styles.dropText}>Haga clic para seleccionar</p>
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

            {downloadUrl && (
              <a
                href={downloadUrl}
                download={downloadName}
                className={styles.downloadLink}
              >
                ⬇️ Descargar resultado (.xlsx)
              </a>
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
