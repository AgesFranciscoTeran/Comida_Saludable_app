const BaseDeDatos = require('./Base_de_datos.js');

async function actualizarEstructuraDB() {
  const db = new BaseDeDatos();
  let conexion;

  try {
    conexion = await db.conectar(); // ✅ Obtener la conexión correctamente
    console.log('🔄 Actualizando estructura de la base de datos...');

    // ❌ No definido antes, lo dejamos vacío si no los usas
    const dropQueries = []; // o puedes definir DROP COLUMN aquí si necesitas

    for (const query of dropQueries) {
      try {
        await conexion.execute(query);
        console.log(`✅ Eliminado: ${query}`);
      } catch (error) {
        if (!error.message.includes('Unknown column')) {
          console.warn(`⚠️ Error al eliminar columna: ${error.message}`);
        }
      }
    }

    // ✅ Asegurar campos necesarios
    const alterQueries = [
      'ALTER TABLE usuario ADD COLUMN edad INT',
      'ALTER TABLE usuario ADD COLUMN peso DECIMAL(5,2)',
      'ALTER TABLE usuario ADD COLUMN altura DECIMAL(5,2)',
      'ALTER TABLE usuario ADD COLUMN sexo CHAR(1) DEFAULT \'M\'',
      'ALTER TABLE usuario ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      'ALTER TABLE usuario ADD COLUMN observaciones TEXT'
    ];

    for (const query of alterQueries) {
      try {
        await conexion.execute(query); // ✅ usar la conexión directamente
        console.log(`✅ Ejecutado: ${query}`);
      } catch (error) {
        if (!error.message.includes('Duplicate column')) {
          console.warn(`⚠️ Advertencia: ${error.message}`);
        }
      }
    }

    console.log('✅ Estructura de la tabla `usuario` actualizada correctamente');
    const estructura = await db.verEstructuraTabla('usuario');
    console.table(estructura);

  } catch (error) {
    console.error('❌ Error al actualizar estructura:', error.message);
  } finally {
    if (conexion) conexion.release();
    await db.desconectar();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  actualizarEstructuraDB();
}

module.exports = { actualizarEstructuraDB };