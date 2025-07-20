const BaseDeDatos = require('./Base_de_datos.js');

async function actualizarEstructuraDB() {
  const db = new BaseDeDatos();
  
  try {
    await db.conectar();
    console.log('Actualizando estructura de la base de datos...');
    
    // Agregar campos faltantes a la tabla usuario
    const alterQueries = [
      'ALTER TABLE usuario ADD COLUMN edad INT',
      'ALTER TABLE usuario ADD COLUMN peso DECIMAL(5,2)',
      'ALTER TABLE usuario ADD COLUMN altura DECIMAL(5,2)',
      'ALTER TABLE usuario ADD COLUMN sexo CHAR(1) DEFAULT "M"',
      'ALTER TABLE usuario ADD COLUMN nivel_actividad VARCHAR(20) DEFAULT "moderado"',
      'ALTER TABLE usuario ADD COLUMN objetivo VARCHAR(20) DEFAULT "mantener"',
      'ALTER TABLE usuario ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
    ];
    
    for (const query of alterQueries) {
      try {
        await db.conexion.execute(query);
        console.log(`Ejecutado: ${query.substring(0, 50)}...`);
      } catch (error) {
        if (!error.message.includes('Duplicate column')) {
          console.log(`Advertencia: ${error.message}`);
        }
      }
    }
    
    console.log('Estructura actualizada correctamente');
    
    // Verificar estructura final
    await db.verEstructuraTabla('usuario');
    
  } catch (error) {
    console.error('Error al actualizar estructura:', error.message);
  } finally {
    await db.desconectar();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  actualizarEstructuraDB();
}

module.exports = { actualizarEstructuraDB };
