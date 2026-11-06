/**
 * Aplica las migraciones pendientes antes de arrancar el servidor.
 *
 * Las bases MySQL creadas antes de este historial (con `prisma db push` o desde un dump) ya tienen
 * el esquema inicial pero no la tabla de control, y Prisma las rechaza con P3005. En ese único caso
 * se registra la línea base como aplicada, sin ejecutar su SQL, y luego se aplica lo pendiente.
 */
const { spawnSync } = require('child_process');

const BASELINE = '20261022000000_init_3nf_schema';

/** Ejecuta un comando de Prisma, muestra su salida y devuelve si terminó bien junto con el texto generado. */
function prisma(...args) {
  const result = spawnSync('npx', ['prisma', ...args], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  return { ok: result.status === 0, output: `${result.stdout || ''}${result.stderr || ''}` };
}

// Primer intento: si funciona, termina. Cualquier error distinto de P3005 es un fallo real.
const first = prisma('migrate', 'deploy');
if (first.ok) process.exit(0);
if (!first.output.includes('P3005')) process.exit(1);

console.log(`Base existente sin historial: se registra ${BASELINE} como línea base.`);
if (!prisma('migrate', 'resolve', '--applied', BASELINE).ok) process.exit(1);
process.exit(prisma('migrate', 'deploy').ok ? 0 : 1);
