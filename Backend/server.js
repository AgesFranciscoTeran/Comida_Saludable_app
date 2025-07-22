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

// Obtener información de la base de datos
app.get('/api/info', async (req, res) => {
  try {
    const totalAlimentos = await db.contarAlimentos();
    res.json({
      totalAlimentos,
      mensaje: 'Base de datos conectada correctamente'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
  console.log('📥 POST /api/usuarios body:', req.body);

  try {
    const {
      nombre, email, edad, peso, altura, sexo,
      observaciones = '', preferencias = [], condiciones = []
    } = req.body;

    // 1. Crear usuario básico
    const usuarioId = await db.crearUsuario(nombre, email, edad, peso, altura, sexo, observaciones);

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
    console.log('✅ Plan generado con ID:', plan.id);

    return res.json({ plan });

  } catch (err) {
    console.error('❌ Error en /api/usuarios:', err.message);
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
    console.error('❌ Error en /api/descargar-plan:', err);
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
    console.error('❌ Error en /api/alimentos/:codigo/analisis:', err);
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
