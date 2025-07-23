const express = require('express');
const cors    = require('cors');
const path    = require('path');
const dotenv = require('dotenv');
dotenv.config();

const BaseDeDatos    = require('./Base_de_datos.js');
const GeneradorPlanes = require('./GeneradorPlanes.js');
const db         = new BaseDeDatos();
const generadorPlanes = new GeneradorPlanes();

const app = express();
app.use(cors());
app.use(express.json());

//  🔹 Servir frontend desde carpeta ../frontend
app.use(express.static(path.join(__dirname, '../frontend')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

const PORT = process.env.PORT || 3001;

// ===== RUTAS DE LA API =====

// Ruta de prueba
app.get('/api/test', (req, res) => {
  res.json({ ok: true });
});

// Inicializar tablas (útil para desarrollo)
app.post('/api/inicializar-tablas', async (req, res) => {
  try {
    await db.crearTablaPlanesYUsuarios();
    res.json({ success: true, mensaje: 'Tablas inicializadas correctamente' });
  } catch (error) {
    console.error('Error al inicializar tablas:', error);
    res.status(500).json({ error: 'Error al inicializar tablas', detalles: error.message });
  }
});

// Obtener información de la base de datos
app.get('/api/info', async (req, res) => {
  try {
    const totalAlimentos = await db.contarAlimentos();
    const resumenInventario = await db.obtenerResumenInventario();
    const totalInventario = resumenInventario.length;
    
    res.json({
      totalAlimentos,
      totalAlimentosConInventario: totalInventario,
      mensaje: 'Base de datos conectada correctamente'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener resumen del inventario
app.get('/api/inventario', async (req, res) => {
  try {
    const resumen = await db.obtenerResumenInventario();
    res.json(resumen);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verificar disponibilidad de un alimento en inventario
app.get('/api/inventario/:codigo/disponibilidad', async (req, res) => {
  try {
    const { codigo } = req.params;
    const cantidad = parseFloat(req.query.cantidad) || 100;
    
    const disponibilidad = await db.verificarDisponibilidadInventario(codigo, cantidad);
    res.json(disponibilidad);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//  Reiniciar inventario (útil para pruebas)
app.post('/api/inventario/reiniciar', async (req, res) => {
  try {
    // Primero verificar si existen registros con bajo inventario
    const verifyQuery = `
      SELECT COUNT(*) as total FROM (
        SELECT codigo, SUM(cantidad) as cantidad_total
        FROM inventario 
        GROUP BY codigo
        HAVING cantidad_total < 100
      ) as productos_bajo_stock
    `;
    
    const verificacion = await db.ejecutarConsulta(verifyQuery);
    
    // Insertar más lotes para productos con bajo stock
    const updateQuery = `
      INSERT INTO inventario (alimento_codigo, cantidad, fecha_entrada, lote_id)
      SELECT codigo, 1000, NOW(), CONCAT('RESTOCK-', codigo, '-', UNIX_TIMESTAMP()) 
      FROM alimentos 
      WHERE codigo IN (
        SELECT codigo FROM (
          SELECT codigo, SUM(cantidad) as cantidad_total
          FROM inventario 
          GROUP BY codigo
          HAVING cantidad_total < 100
        ) as productos_bajo_stock
      )
    `;
    
    const result = await db.ejecutarConsulta(updateQuery);
    
    res.json({
      success: true,
      mensaje: 'Inventario reiniciado exitosamente',
      productosConBajoStock: verificacion[0].total,
      nuevosLotesAgregados: result.affectedRows
    });
  } catch (error) {
    console.error(' Error al reiniciar inventario:', error.message);
    res.status(500).json({ 
      success: false,
      error: 'Error al reiniciar inventario',
      detalles: error.message 
    });
  }
});

//  Confirmar plan y reducir inventario
app.post('/api/planes/confirmar', async (req, res) => {
  try {
    const { planData } = req.body;
    
    if (!planData) {
      return res.status(400).json({
        success: false,
        error: 'Datos del plan requeridos'
      });
    }
    
    const resultado = await generadorPlanes.confirmarPlanYReducirInventario(planData);
    
    res.json(resultado);
    
  } catch (error) {
    console.error(' Error al confirmar plan:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error al confirmar plan',
      detalles: error.message
    });
  }
});
app.get('/api/preferencias', async (req, res) => {
  try {
    const resultados = await db.ejecutarConsulta('SELECT * FROM preferencias');
    res.json(resultados);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener preferencias' });
  }
});

app.get('/api/condiciones', async (req, res) => {
  try {
    const resultados = await db.ejecutarConsulta('SELECT * FROM condiciones_medicas');
    res.json(resultados);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener condiciones médicas' });
  }
});
// Crear usuario
//  🔹 Ruta corregida para crear usuario y generar plan
// server.js (fragmento corregido)
app.post('/api/usuarios', async (req, res) => {
  console.log(' POST /api/usuarios body:', req.body);

  try {
    const {
      nombre, email, edad, peso, altura, sexo,
      observaciones = '', preferencias = [], condiciones = []
    } = req.body;

    // Normalizar el sexo para la base de datos
    let sexoNormalizado = sexo;
    if (sexo === 'M' || sexo === 'masculino' || sexo === 'Masculino') {
      sexoNormalizado = 'masculino';
    } else if (sexo === 'F' || sexo === 'femenino' || sexo === 'Femenino') {
      sexoNormalizado = 'femenino';
    }

    // 1. Crear usuario básico
    const usuarioId = await db.crearUsuario(nombre, email, edad, peso, altura, sexoNormalizado, observaciones);

    // 2. Insertar preferencias
    for (const prefId of preferencias.map(Number)) {
      await db.ejecutarConsulta(
          'INSERT INTO usuario_preferencias (usuario_id, preferencia_id) VALUES (?, ?)',
          [usuarioId, prefId]
      );
    }

    // 3. Insertar condiciones médicas
    for (const condId of condiciones.map(Number)) {
      await db.ejecutarConsulta(
          'INSERT INTO usuario_condiciones (usuario_id, condicion_id) VALUES (?, ?)',
          [usuarioId, condId]
      );
    }

    // 4. Obtener usuario completo
    const usuario = await db.obtenerUsuarioCompletoPorEmail(email);

    // 5. Generar plan personalizado
    const plan = await generadorPlanes.generarPlanPersonalizado(usuario);
    console.log(' Plan generado con ID:', plan.id);

    return res.json({ plan });

  } catch (err) {
    console.error(' Error en /api/usuarios:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Generar plan nutricional
app.get('/api/descargar-plan/:planId', async (req, res) => {
  const planId = parseInt(req.params.planId, 10);
  console.log(`⬇️ GET /api/descargar-plan/${planId}`);
  try {
    const planData = await generadorPlanes.obtenerPlanCompleto(planId);
    console.log('📤 planData para descarga:', planData);
    const json = JSON.stringify(planData, null, 2);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename=plan_${planId}.json`);
    return res.send(json);
  } catch(err) {
    console.error(' Error en /api/descargar-plan:', err);
    return res.status(500).json({ error: 'No se pudo descargar el plan' });
  }
});


// Obtener análisis nutricional detallado de un alimento
app.get('/api/alimentos/:codigo/analisis', async (req, res) => {
  const { codigo } = req.params;
  const cantidad = parseFloat(req.query.cantidad) || 100;

  try {
    const alimento = await db.obtenerAlimentoPorCodigo(codigo);
    if (!alimento) {
      return res.status(404).json({ error: 'Alimento no encontrado' });
    }

    const analizado = generadorPlanes.calcularNutrientesTotales(alimento, cantidad);

    // Ejemplo muy básico de análisis
    const recomendaciones = {
      fortalezas: [],
      recomendaciones: [],
      consideraciones: []
    };

    if (analizado.nutrientes.carbohidratos > 20) {
      recomendaciones.fortalezas.push('Buena fuente de energía');
    }
    if (analizado.nutrientes.fibra > 1) {
      recomendaciones.recomendaciones.push('Aporta algo de fibra');
    }
    if (analizado.nutrientes.sodio > 200) {
      recomendaciones.consideraciones.push('Moderado contenido en sodio');
    }

    return res.json({
      alimento: analizado,
      recomendaciones
    });

  } catch (err) {
    console.error(' Error en /api/alimentos/:codigo/analisis:', err);
    return res.status(500).json({ error: 'Error al analizar alimento' });
  }
});

// Comparar alimentos nutricionalmente
app.post('/api/alimentos/comparar', async (req, res) => {
  try {
    const { codigos, cantidad = 100 } = req.body;
    
    if (!Array.isArray(codigos) || codigos.length < 2) {
      return res.status(400).json({ error: 'Se requieren al menos 2 códigos de alimentos' });
    }
    
    const comparacion = [];
    
    for (const codigo of codigos) {
      const alimento = await db.obtenerAlimentoPorCodigo(codigo);
      if (alimento) {
        const nutrientesCalculados = generador.calcularNutrientesTotales(alimento, cantidad);
        comparacion.push(nutrientesCalculados);
      }
    }
    
    res.json({
      comparacion,
      analisis: generador.compararAlimentos(comparacion)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Buscar alimentos por nutriente específico
app.get('/api/alimentos/nutriente/:nutriente', async (req, res) => {
  try {
    const { nutriente } = req.params;
    const { minimo = 0, limite = 20 } = req.query;
    
    const alimentos = await db.buscarAlimentosPorNutriente(
      nutriente, 
      parseFloat(minimo), 
      parseInt(limite)
    );
    
    res.json({
      nutriente,
      alimentos,
      total: alimentos.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener alimentos más balanceados nutricionalmente
app.get('/api/alimentos/balanceados', async (req, res) => {
  try {
    const { limite = 10 } = req.query;
    const alimentos = await db.obtenerAlimentosBalanceados(parseInt(limite));
    
    res.json({
      message: 'Alimentos más balanceados nutricionalmente',
      alimentos
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener estadísticas nutricionales de la base de datos
app.get('/api/estadisticas', async (req, res) => {
  try {
    const estadisticas = await db.obtenerEstadisticasNutricionales();
    
    res.json({
      message: 'Estadísticas de la base de datos nutricional',
      estadisticas
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener plan completo
app.get('/api/planes/:planId', async (req, res) => {
  try {
    const planCompleto = await generador.obtenerPlanCompleto(req.params.planId);
    res.json(planCompleto);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== RUTAS PARA PLANES GUARDADOS =====

// Obtener todos los planes de un usuario o todos los planes
app.get('/api/planes', async (req, res) => {
  try {
    const { email } = req.query;
    
    let query = `
      SELECT p.*, u.nombre, u.edad, u.peso, u.altura, u.sexo 
      FROM planes p 
      JOIN usuarios u ON p.usuario_id = u.id 
      ORDER BY p.fecha_creacion DESC
    `;
    
    let params = [];
    
    if (email) {
      query = `
        SELECT p.*, u.nombre, u.edad, u.peso, u.altura, u.sexo 
        FROM planes p 
        JOIN usuarios u ON p.usuario_id = u.id 
        WHERE u.email = ?
        ORDER BY p.fecha_creacion DESC
      `;
      params = [email];
    }
    
    const planes = await db.ejecutarConsulta(query, params);
    res.json(planes);
  } catch (error) {
    console.error('Error al obtener planes:', error);
    res.status(500).json({ error: 'Error al obtener los planes guardados' });
  }
});

// Obtener un plan específico por ID
app.get('/api/planes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Obtener datos básicos del plan
    const planQuery = `
      SELECT p.*, u.nombre, u.edad, u.peso, u.altura, u.sexo, u.email
      FROM planes p 
      JOIN usuarios u ON p.usuario_id = u.id 
      WHERE p.id = ?
    `;
    
    const planData = await db.ejecutarConsulta(planQuery, [id]);
    
    if (planData.length === 0) {
      return res.status(404).json({ error: 'Plan no encontrado' });
    }
    
    const plan = planData[0];
    
    // Obtener el contenido del plan (puede estar en JSON)
    if (plan.contenido_plan) {
      try {
        const contenidoPlan = JSON.parse(plan.contenido_plan);
        
        // Estructurar la respuesta similar a como se genera un plan nuevo
        const response = {
          id: plan.id,
          nombre: plan.nombre,
          edad: plan.edad,
          peso: plan.peso,
          altura: plan.altura,
          sexo: plan.sexo,
          fecha_creacion: plan.fecha_creacion,
          calorias_objetivo: plan.calorias_objetivo,
          requerimientos: contenidoPlan.requerimientos,
          planSemanal: contenidoPlan.planSemanal,
          resumenNutricionalSemanal: contenidoPlan.resumenNutricionalSemanal,
          cumplimiento: contenidoPlan.cumplimiento,
          promedioSemanal: contenidoPlan.promedioSemanal
        };
        
        res.json(response);
      } catch (parseError) {
        console.error('Error al parsear contenido del plan:', parseError);
        res.status(500).json({ error: 'Error al cargar el contenido del plan' });
      }
    } else {
      // Si no hay contenido guardado, generar un plan nuevo basado en los datos del usuario
      const usuario = {
        id: plan.usuario_id,
        nombre: plan.nombre,
        email: plan.email,
        edad: plan.edad,
        peso: plan.peso,
        altura: plan.altura,
        sexo: plan.sexo
      };
      
      const nuevoPlan = await generadorPlanes.generarPlanPersonalizado(usuario);
      res.json(nuevoPlan);
    }
    
  } catch (error) {
    console.error('Error al obtener plan específico:', error);
    res.status(500).json({ error: 'Error al cargar el plan' });
  }
});

// Eliminar un plan
app.delete('/api/planes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.ejecutarConsulta('DELETE FROM planes WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Plan no encontrado' });
    }
    
    res.json({ success: true, message: 'Plan eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar plan:', error);
    res.status(500).json({ error: 'Error al eliminar el plan' });
  }
});

// Buscar alimentos
app.get('/api/alimentos', async (req, res) => {
  try {
    const { buscar, limite } = req.query;
    const alimentos = await db.buscarAlimentos(buscar || '', parseInt(limite) || 20);
    res.json(alimentos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener alimentos por rango de calorías
app.get('/api/alimentos/calorias/:min/:max', async (req, res) => {
  try {
    const { min, max } = req.params;
    const { limite } = req.query;
    const alimentos = await db.obtenerAlimentosPorCalorias(
      parseInt(min), 
      parseInt(max), 
      parseInt(limite) || 10
    );
    res.json(alimentos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
  console.log(`Accede a: http://localhost:${PORT}`);
  console.log(`API disponible en: http://localhost:${PORT}/api/test`);
});
