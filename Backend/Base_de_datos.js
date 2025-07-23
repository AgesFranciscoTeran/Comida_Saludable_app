const mysql = require('mysql2/promise');
require('dotenv').config(); // ✅ Cargar .env

class BaseDeDatos {
  constructor() {
    this.config = {
      host: process.env.MYSQLHOST,
      user: process.env.MYSQLUSER,
      password: process.env.MYSQLPASSWORD,
      database: process.env.MYSQLDATABASE,
      port: process.env.MYSQLPORT,
      // Configuración del pool de conexiones
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    };
    console.log("Variables de entorno:");
    console.log("HOST:", process.env.MYSQLHOST);
    console.log("USER:", process.env.MYSQLUSER);
    console.log("PASS:", process.env.MYSQLPASSWORD ? '***' : 'MISSING');
    console.log("DATABASE:", process.env.MYSQLDATABASE);
    console.log("PORT:", process.env.MYSQLPORT);
    // Crear pool de conexiones
    this.pool = mysql.createPool(this.config);
  }

  async conectar() {
    try {
      // Usar pool en lugar de conexión individual
      const connection = await this.pool.getConnection();
      return connection;
    } catch (error) {
      console.error('Error de conexión:', error.message);
      throw error;
    }
  }

  async desconectar() {
    if (this.pool) {
      await this.pool.end();
    }
  }

  async verTablas() {
    let connection;
    try {
      connection = await this.pool.getConnection();
      
      const [tables] = await connection.execute('SHOW TABLES');
      const tableNames = tables.map(table => Object.values(table)[0]);
      
      return tableNames;
    } catch (error) {
      console.error('Error al obtener tablas:', error.message);
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }

  async verEstructuraTabla(nombreTabla) {
    let connection;
    try {
      connection = await this.pool.getConnection();
      
      const [columns] = await connection.execute(`DESCRIBE ${nombreTabla}`);
      
      return columns;
    } catch (error) {
      console.error(`Error al obtener estructura de ${nombreTabla}:`, error.message);
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }

  async verDatosTabla(nombreTabla, limite = 5) {
    let connection;
    try {
      connection = await this.pool.getConnection();
      
      const [rows] = await connection.execute(`SELECT * FROM ${nombreTabla} LIMIT ${limite}`);
      
      return rows;
    } catch (error) {
      console.error(`Error al obtener datos de ${nombreTabla}:`, error.message);
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }

  async explorarTodasLasTablas() {
    let connection;
    try {
      connection = await this.pool.getConnection();
      const tablas = await this.verTablas();
      
      for (const tabla of tablas) {
        await this.verEstructuraTabla(tabla);
        await this.verDatosTabla(tabla);
        console.log('\n' + '-'.repeat(50) + '\n');
      }
      
    } catch (error) {
      console.error('Error al explorar la base de datos:', error.message);
    } finally {
      if (connection) connection.release();
    }
  }

  async ejecutarConsulta(sql, params = []) {
    let connection;
    try {
      connection = await this.pool.getConnection();

      const [result] = await connection.execute(sql, params);
      return result;
    } catch (error) {
      console.error('Error al ejecutar consulta SQL:', error.message);
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }

  // ===== MÉTODOS PARA USUARIOS =====
  async crearUsuario(nombre, email, edad, peso, altura, sexo, observaciones = null) {
    let connection;
    try {
      connection = await this.pool.getConnection();
      const sql = `INSERT INTO usuario (nombre, email, edad, peso, altura, sexo, observaciones)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`;
      const [resultado] = await connection.execute(sql, [nombre, email, edad, peso, altura, sexo, observaciones]);
      return resultado.insertId;
    } catch (error) {
      console.error('Error al crear usuario:', error.message);
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }

  async obtenerUsuarioPorNombre(nombre) {
    let connection;
    try {
      connection = await this.pool.getConnection();
      
      // Obtener el usuario más reciente con ese nombre
      const sql = `SELECT * FROM usuario WHERE nombre = ? ORDER BY id DESC LIMIT 1`;
      const [usuarios] = await connection.execute(sql, [nombre]);
      
      return usuarios[0] || null;
    } catch (error) {
      console.error('Error al obtener usuario:', error.message);
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }
  async obtenerUsuarioPorEmail(email) {
    let connection;
    try {
      connection = await this.pool.getConnection();
      const [rows] = await connection.execute(
          `SELECT * 
         FROM usuario 
        WHERE email = ? 
        ORDER BY id DESC 
        LIMIT 1`,
          [email]
      );
      return rows[0] || null;
    } catch (err) {
      console.error('Error en obtenerUsuarioPorEmail:', err);
      throw err;
    } finally {
      if (connection) connection.release();
    }
  }
  async obtenerUsuarioCompletoPorEmail(email) {
    let connection;
    try {
      connection = await this.pool.getConnection();
      // 1) Datos básicos
      const [users] = await connection.execute(
          `SELECT *
           FROM usuario
           WHERE email = ?
           ORDER BY id DESC
           LIMIT 1`,
          [email]
      );
      const usuario = users[0];
      if (!usuario) return null;

      // 2) Array de preferencias
      const [prefs] = await connection.execute(
          `SELECT preferencia_id
           FROM usuario_preferencias
           WHERE usuario_id = ?`,
          [usuario.id]
      );
      usuario.preferencias = prefs.map(r => r.preferencia_id);

      // 3) Array de condiciones
      const [conds] = await connection.execute(
          `SELECT condicion_id
           FROM usuario_condiciones
           WHERE usuario_id = ?`,
          [usuario.id]
      );
      usuario.condiciones = conds.map(r => r.condicion_id);

      return usuario;
    } catch (err) {
      console.error('Error en obtenerUsuarioCompletoPorEmail:', err);
      throw err;
    } finally {
      if (connection) connection.release();
    }
  }

  // ===== MÉTODOS PARA PLANES NUTRICIONALES =====
  async crearPlanNutricional(nombre, usuarioId) {
    let connection;
    try {
      connection = await this.pool.getConnection();
      
      const sql = `INSERT INTO plan_nutricional (nombre) VALUES (?)`;
      const [resultado] = await connection.execute(sql, [nombre]);
      
      // Asociar plan al usuario
      if (usuarioId) {
        await connection.execute(
          `UPDATE usuario SET plan_nutricional_id = ? WHERE id = ?`,
          [resultado.insertId, usuarioId]
        );
      }
      
      console.log(`Plan nutricional creado con ID: ${resultado.insertId}`);
      return resultado.insertId;
    } catch (error) {
      console.error('Error al crear plan nutricional:', error.message);
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }

  async agregarAlimentoAPlan(planId, alimentoCodigo, cantidad) {
    let connection;
    try {
      connection = await this.pool.getConnection();
      
      const sql = `INSERT INTO detalle_plan (plan_nutricional_id, alimento_codigo, cantidad) 
                   VALUES (?, ?, ?)`;
      await connection.execute(sql, [planId, alimentoCodigo, cantidad]);
      
      console.log(`Alimento ${alimentoCodigo} agregado al plan ${planId}`);
    } catch (error) {
      console.error('Error al agregar alimento al plan:', error.message);
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }

  // ===== MÉTODOS PARA ALIMENTOS =====
  async buscarAlimentos(termino = '', limite = 50) {
    let connection;
    try {
      connection = await this.pool.getConnection();
      
      // Asegurar que limite sea un número válido
      const limiteValido = Math.max(1, Math.min(parseInt(limite) || 50, 1000));
      
      let sql = `SELECT * FROM alimentos`;
      let params = [];
      
      if (termino) {
        sql += ` WHERE nombre LIKE ?`;
        params.push(`%${termino}%`);
      }
      
      sql += ` LIMIT ${limiteValido}`;
      
      const [alimentos] = await connection.execute(sql, params);
      return alimentos;
    } catch (error) {
      console.error('Error al buscar alimentos:', error.message);
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }

  async obtenerAlimentosPorCalorias(minCalorias, maxCalorias, limite = 20) {
    let connection;
    try {
      connection = await this.pool.getConnection();
      
      // Asegurar que limite sea un número válido
      const limiteValido = Math.max(1, Math.min(parseInt(limite) || 20, 1000));
      
      const sql = `SELECT * FROM alimentos 
                   WHERE energia_kcal BETWEEN ? AND ? 
                   ORDER BY RAND() 
                   LIMIT ${limiteValido}`;
      const [alimentos] = await connection.execute(sql, [minCalorias, maxCalorias]);
      return alimentos;
    } catch (error) {
      console.error('Error al obtener alimentos por calorías:', error.message);
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }

  async contarAlimentos() {
    let connection;
    try {
      connection = await this.pool.getConnection();
      
      const sql = `SELECT COUNT(*) as total FROM alimentos`;
      const [resultado] = await connection.execute(sql);
      return resultado[0].total;
    } catch (error) {
      console.error('Error al contar alimentos:', error.message);
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }

  // Obtener alimento por código específico
  async obtenerAlimentoPorCodigo(codigo) {
    let connection;
    try {
      connection = await this.pool.getConnection();
      
      const sql = `SELECT * FROM alimentos WHERE codigo = ?`;
      const [alimentos] = await connection.execute(sql, [codigo]);
      return alimentos[0] || null;
    } catch (error) {
      console.error('Error al obtener alimento por código:', error.message);
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }

  // Buscar alimentos por nutriente específico
  async buscarAlimentosPorNutriente(nutriente, valorMinimo, limite = 20) {
    let connection;
    try {
      connection = await this.pool.getConnection();
      
      const limiteValido = Math.max(1, Math.min(parseInt(limite) || 20, 100));
      
      // Mapear nombres de nutrientes a columnas de la base de datos
      const columnasNutrientes = {
        'proteina': 'proteina_g',
        'grasa': 'grasa_total_g',
        'carbohidratos': 'carbohidratos_g',
        'fibra': 'fibra_g',
        'calcio': 'calcio_mg',
        'hierro': 'hierro_mg',
        'zinc': 'zinc_mg',
        'vitamina_c': 'vitc_mg',
        'vitamina_a': 'vita_ug',
        'folato': 'folato_ug',
        'vitamina_b12': 'vitb12_ug',
        'potasio': 'potasio_mg',
        'fosforo': 'fosforo_mg'
      };
      
      const columna = columnasNutrientes[nutriente];
      if (!columna) {
        throw new Error(`Nutriente no válido: ${nutriente}`);
      }
      
      const sql = `
        SELECT *, ${columna} as valor_nutriente 
        FROM alimentos 
        WHERE ${columna} >= ? AND ${columna} IS NOT NULL
        ORDER BY ${columna} DESC 
        LIMIT ${limiteValido}
      `;
      
      const [alimentos] = await connection.execute(sql, [valorMinimo]);
      return alimentos;
    } catch (error) {
      console.error('Error al buscar alimentos por nutriente:', error.message);
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }

  // Obtener alimentos ricos en múltiples nutrientes
  async obtenerAlimentosBalanceados(limite = 10) {
    let connection;
    try {
      connection = await this.pool.getConnection();
      
      const sql = `
        SELECT *,
               (proteina_g + carbohidratos_g + COALESCE(fibra_g, 0)) as puntuacion_macro,
               (COALESCE(calcio_mg, 0)/1000 + COALESCE(hierro_mg, 0)/18 + 
                COALESCE(vitc_mg, 0)/90 + COALESCE(vita_ug, 0)/900) as puntuacion_micro
        FROM alimentos 
        WHERE energia_kcal > 0 
          AND proteina_g > 0 
          AND (carbohidratos_g > 0 OR grasa_total_g > 0)
        ORDER BY (puntuacion_macro + puntuacion_micro) DESC
        LIMIT ?
      `;
      
      const [alimentos] = await connection.execute(sql, [limite]);
      return alimentos;
    } catch (error) {
      console.error('Error al obtener alimentos balanceados:', error.message);
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }

  // Obtener estadísticas nutricionales de la base de datos
  async obtenerEstadisticasNutricionales() {
    let connection;
    try {
      connection = await this.pool.getConnection();
      
      const sql = `
        SELECT 
          COUNT(*) as total_alimentos,
          AVG(energia_kcal) as calorias_promedio,
          MAX(energia_kcal) as calorias_maximas,
          MIN(energia_kcal) as calorias_minimas,
          AVG(proteina_g) as proteina_promedio,
          MAX(proteina_g) as proteina_maxima,
          AVG(grasa_total_g) as grasa_promedio,
          AVG(carbohidratos_g) as carbohidratos_promedio,
          COUNT(CASE WHEN fibra_g > 0 THEN 1 END) as alimentos_con_fibra,
          COUNT(CASE WHEN calcio_mg > 0 THEN 1 END) as alimentos_con_calcio,
          COUNT(CASE WHEN hierro_mg > 0 THEN 1 END) as alimentos_con_hierro,
          COUNT(CASE WHEN vitc_mg > 0 THEN 1 END) as alimentos_con_vitamina_c
        FROM alimentos 
        WHERE energia_kcal > 0
      `;
      
      const [estadisticas] = await connection.execute(sql);
      return estadisticas[0];
    } catch (error) {
      console.error('Error al obtener estadísticas:', error.message);
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }
  // backend/Base_de_datos.js
  async obtenerAlimentosFiltrados(preferencias = [], condiciones = [], limite = 10) {
    // Asegurarnos de que sean números
    preferencias = (preferencias || []).map(Number);
    condiciones = (condiciones || []).map(Number);

    const connection = await this.pool.getConnection();
    try {
      // 1) SQL base
      let sql    = 'SELECT a.* FROM alimentos a WHERE energia_kcal > 0';
      const params = [];

      // 2) Filtrar preferencias (un solo ? que recibirá un array)
      if (preferencias.length) {
        sql += `
        AND NOT EXISTS (
          SELECT 1
            FROM alimento_preferencia ap
           WHERE ap.alimento_codigo = a.codigo
             AND ap.preferencia_id IN (?))
      `;
        params.push(preferencias);
      }

      // 3) Filtrar condiciones
      if (condiciones.length) {
        sql += `
        AND NOT EXISTS (
          SELECT 1
            FROM alimento_condicion ac
           WHERE ac.alimento_codigo = a.codigo
             AND ac.condicion_id IN (?))
      `;
        params.push(condiciones);
      }

      // 4) Limitar resultados
      sql += ' ORDER BY RAND() LIMIT ?';
      params.push(limite);

      // 5) Usamos query() para que expanda los arrays en IN (?)
      const [alimentos] = await connection.query(sql, params);
      return alimentos;

    } catch (err) {
      console.error('Error al obtener alimentos filtrados:', err.message);
      throw err;
    } finally {
      connection.release();
    }
  }

  // ===== MÉTODOS PARA INVENTARIO =====
  
  // Verificar disponibilidad de un alimento en inventario
  async verificarDisponibilidadInventario(codigoAlimento, cantidadRequerida) {
    let connection;
    try {
      connection = await this.pool.getConnection();
      
      const sql = `
        SELECT SUM(cantidad_g) as cantidad_disponible
        FROM inventario 
        WHERE codigo_alimento = ? AND cantidad_g > 0
      `;
      
      const [resultado] = await connection.execute(sql, [codigoAlimento]);
      const cantidadDisponible = resultado[0].cantidad_disponible || 0;
      
      return {
        disponible: cantidadDisponible >= cantidadRequerida,
        cantidadDisponible: cantidadDisponible,
        cantidadRequerida: cantidadRequerida
      };
    } catch (error) {
      console.error('Error al verificar disponibilidad en inventario:', error.message);
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }

  // Obtener alimentos disponibles en inventario con filtros
  async obtenerAlimentosConInventario(preferencias = [], condiciones = [], limite = 10) {
    // Asegurarnos de que sean números
    preferencias = (preferencias || []).map(Number);
    condiciones = (condiciones || []).map(Number);

    const connection = await this.pool.getConnection();
    try {
      // 1) SQL base - solo alimentos que tienen inventario disponible
      let sql = `
        SELECT DISTINCT a.*, SUM(i.cantidad_g) as cantidad_disponible
        FROM alimentos a
        INNER JOIN inventario i ON a.codigo = i.codigo_alimento
        WHERE a.energia_kcal > 0 AND i.cantidad_g > 0
      `;
      const params = [];

      // 2) Filtrar preferencias
      if (preferencias.length) {
        sql += `
        AND NOT EXISTS (
          SELECT 1
            FROM alimento_preferencia ap
           WHERE ap.alimento_codigo = a.codigo
             AND ap.preferencia_id IN (?))
      `;
        params.push(preferencias);
      }

      // 3) Filtrar condiciones
      if (condiciones.length) {
        sql += `
        AND NOT EXISTS (
          SELECT 1
            FROM alimento_condicion ac
           WHERE ac.alimento_codigo = a.codigo
             AND ac.condicion_id IN (?))
      `;
        params.push(condiciones);
      }

      // 4) Agrupar y limitar resultados
      sql += `
        GROUP BY a.codigo
        HAVING cantidad_disponible > 0
        ORDER BY RAND() 
        LIMIT ?
      `;
      params.push(limite);

      // 5) Usamos query() para que expanda los arrays en IN (?)
      const [alimentos] = await connection.query(sql, params);
      return alimentos;

    } catch (err) {
      console.error('Error al obtener alimentos con inventario:', err.message);
      throw err;
    } finally {
      connection.release();
    }
  }

  // Reducir cantidad del inventario cuando se usa un alimento
  async reducirInventario(codigoAlimento, cantidadUsada) {
    let connection;
    try {
      connection = await this.pool.getConnection();
      await connection.beginTransaction();

      // Obtener registros de inventario ordenados por fecha (FIFO)
      const sqlSelect = `
        SELECT id, cantidad_g 
        FROM inventario 
        WHERE codigo_alimento = ? AND cantidad_g > 0
        ORDER BY fecha_ingreso ASC, id ASC
      `;
      
      const [registros] = await connection.execute(sqlSelect, [codigoAlimento]);
      
      if (registros.length === 0) {
        throw new Error(`No hay inventario disponible para el alimento ${codigoAlimento}`);
      }

      let cantidadRestante = cantidadUsada;
      const actualizaciones = [];

      for (const registro of registros) {
        if (cantidadRestante <= 0) break;

        if (registro.cantidad_g >= cantidadRestante) {
          // Este registro tiene suficiente cantidad
          const nuevaCantidad = registro.cantidad_g - cantidadRestante;
          actualizaciones.push({
            id: registro.id,
            nuevaCantidad: nuevaCantidad
          });
          cantidadRestante = 0;
        } else {
          // Este registro se agota completamente
          actualizaciones.push({
            id: registro.id,
            nuevaCantidad: 0
          });
          cantidadRestante -= registro.cantidad_g;
        }
      }

      if (cantidadRestante > 0) {
        throw new Error(`Inventario insuficiente. Faltan ${cantidadRestante}g del alimento ${codigoAlimento}`);
      }

      // Aplicar las actualizaciones
      for (const actualizacion of actualizaciones) {
        const sqlUpdate = `
          UPDATE inventario 
          SET cantidad_g = ? 
          WHERE id = ?
        `;
        await connection.execute(sqlUpdate, [actualizacion.nuevaCantidad, actualizacion.id]);
      }

      await connection.commit();
      console.log(`✅ Inventario reducido: ${cantidadUsada}g del alimento ${codigoAlimento}`);
      
      return {
        success: true,
        cantidadReducida: cantidadUsada,
        codigoAlimento: codigoAlimento
      };

    } catch (error) {
      await connection.rollback();
      console.error('Error al reducir inventario:', error.message);
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }

  // Obtener resumen del inventario
  async obtenerResumenInventario() {
    let connection;
    try {
      connection = await this.pool.getConnection();
      
      const sql = `
        SELECT 
          a.codigo,
          a.nombre,
          SUM(i.cantidad_g) as cantidad_total,
          COUNT(i.id) as num_lotes,
          MIN(i.fecha_ingreso) as fecha_mas_antigua,
          MAX(i.fecha_ingreso) as fecha_mas_reciente
        FROM alimentos a
        LEFT JOIN inventario i ON a.codigo = i.codigo_alimento AND i.cantidad_g > 0
        GROUP BY a.codigo, a.nombre
        HAVING cantidad_total > 0
        ORDER BY cantidad_total DESC
      `;
      
      const [resumen] = await connection.execute(sql);
      return resumen;
    } catch (error) {
      console.error('Error al obtener resumen de inventario:', error.message);
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }

  // ===== MÉTODOS PARA PLANES GUARDADOS =====
  
  async crearTablaPlanesYUsuarios() {
    let connection;
    try {
      connection = await this.pool.getConnection();
      
      // Crear tabla usuarios si no existe
      const sqlUsuarios = `
        CREATE TABLE IF NOT EXISTS usuarios (
          id INT AUTO_INCREMENT PRIMARY KEY,
          nombre VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE,
          edad INT NOT NULL,
          peso DECIMAL(5,2) NOT NULL,
          altura INT NOT NULL,
          sexo ENUM('masculino', 'femenino') NOT NULL,
          observaciones TEXT,
          fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await connection.execute(sqlUsuarios);
      
      // Crear tabla planes si no existe
      const sqlPlanes = `
        CREATE TABLE IF NOT EXISTS planes (
          id INT AUTO_INCREMENT PRIMARY KEY,
          usuario_id INT,
          nombre VARCHAR(255) NOT NULL,
          edad INT NOT NULL,
          peso DECIMAL(5,2) NOT NULL,
          altura INT NOT NULL,
          sexo ENUM('masculino', 'femenino') NOT NULL,
          calorias_objetivo INT,
          contenido_plan LONGTEXT,
          fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
        )
      `;
      await connection.execute(sqlPlanes);
      
      console.log('✅ Tablas usuarios y planes creadas/verificadas exitosamente');
      return true;
    } catch (error) {
      console.error('Error al crear tablas:', error.message);
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }

  async guardarPlan(usuario, planCompleto) {
    let connection;
    try {
      connection = await this.pool.getConnection();
      
      // Guardar usuario primero (o actualizarlo)
      let usuarioId;
      const emailPlan = usuario.email || `usuario_${Date.now()}_${Math.random().toString(36).substr(2, 9)}@temp.com`;
      
      const usuarioExistente = await this.obtenerUsuarioPorEmail(emailPlan);
      
      if (usuarioExistente) {
        usuarioId = usuarioExistente.id;
        console.log(` Usuario existente encontrado con ID: ${usuarioId}`);
      } else {
        try {
          // Normalizar el sexo para la base de datos
          let sexoNormalizado = usuario.sexo;
          if (usuario.sexo === 'M' || usuario.sexo === 'masculino' || usuario.sexo === 'Masculino') {
            sexoNormalizado = 'masculino';
          } else if (usuario.sexo === 'F' || usuario.sexo === 'femenino' || usuario.sexo === 'Femenino') {
            sexoNormalizado = 'femenino';
          }
          
          usuarioId = await this.crearUsuario(
            usuario.nombre,
            emailPlan,
            usuario.edad,
            usuario.peso,
            usuario.altura,
            sexoNormalizado,
            usuario.observaciones
          );
          console.log(`👤 Nuevo usuario creado con ID: ${usuarioId}`);
        } catch (error) {
          if (error.message.includes('Duplicate entry')) {
            // Si aún hay duplicado, generar un email único
            const emailUnico = `usuario_${Date.now()}_${Math.random().toString(36).substr(2, 9)}@temp.com`;
            let sexoNormalizado = usuario.sexo;
            if (usuario.sexo === 'M' || usuario.sexo === 'masculino' || usuario.sexo === 'Masculino') {
              sexoNormalizado = 'masculino';
            } else if (usuario.sexo === 'F' || usuario.sexo === 'femenino' || usuario.sexo === 'Femenino') {
              sexoNormalizado = 'femenino';
            }
            
            usuarioId = await this.crearUsuario(
              usuario.nombre,
              emailUnico,
              usuario.edad,
              usuario.peso,
              usuario.altura,
              sexoNormalizado,
              usuario.observaciones
            );
            console.log(`👤 Usuario creado con email único: ${emailUnico}, ID: ${usuarioId}`);
          } else {
            throw error;
          }
        }
      }
      
      // Guardar el plan - también normalizar sexo aquí
      let sexoParaPlan = usuario.sexo;
      if (usuario.sexo === 'M' || usuario.sexo === 'masculino' || usuario.sexo === 'Masculino') {
        sexoParaPlan = 'masculino';
      } else if (usuario.sexo === 'F' || usuario.sexo === 'femenino' || usuario.sexo === 'Femenino') {
        sexoParaPlan = 'femenino';
      }
      
      const sql = `
        INSERT INTO planes (
          usuario_id, nombre, edad, peso, altura, sexo, 
          calorias_objetivo, contenido_plan
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const contenidoJson = JSON.stringify(planCompleto);
      const caloriaObjetivo = planCompleto.requerimientos?.calorias || null;
      
      const [resultado] = await connection.execute(sql, [
        usuarioId,
        usuario.nombre,
        usuario.edad,
        usuario.peso,
        usuario.altura,
        sexoParaPlan,
        caloriaObjetivo,
        contenidoJson
      ]);
      
      console.log(`💾 Plan guardado exitosamente con ID: ${resultado.insertId}`);
      return resultado.insertId;
    } catch (error) {
      console.error('Error al guardar plan:', error.message);
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }

  async obtenerUsuarioPorEmail(email) {
    let connection;
    try {
      connection = await this.pool.getConnection();
      const sql = 'SELECT * FROM usuarios WHERE email = ?';
      const [resultado] = await connection.execute(sql, [email]);
      return resultado.length > 0 ? resultado[0] : null;
    } catch (error) {
      // Si la tabla no existe, devolver null
      if (error.code === 'ER_NO_SUCH_TABLE') {
        return null;
      }
      console.error('Error al obtener usuario por email:', error.message);
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }

  async obtenerAlimentosBalanceados() {
    let connection;
    try {
      connection = await this.pool.getConnection();
      const sql = `
        SELECT * FROM alimentos 
        WHERE energia_kcal > 50 AND proteina_g > 0 
        ORDER BY RAND() 
        LIMIT 50
      `;
      const [alimentos] = await connection.execute(sql);
      return alimentos;
    } catch (error) {
      console.error('Error al obtener alimentos balanceados:', error.message);
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }
}

// Exportar la clase para usar en otros archivos
module.exports = BaseDeDatos;

