const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const BaseDeDatos = require('./Base_de_datos.js');
const GeneradorPlanes = require('./GeneradorPlanes.js');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Servir archivos estáticos (para el frontend)
app.use(express.static(path.join(__dirname, '../frontend')));

// Inicializar clases
const db = new BaseDeDatos();
const generador = new GeneradorPlanes();

// ===== RUTAS DE LA API =====

// Ruta de prueba
app.get('/api/test', (req, res) => {
  res.json({ message: 'API de Alimentación funcionando correctamente!' });
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

// Crear usuario
app.post('/api/usuarios', async (req, res) => {
  try {
    const { nombre, edad, peso, altura, sexo, nivelActividad, objetivo } = req.body;
    
    const usuarioId = await db.crearUsuario(nombre, edad, peso, altura, objetivo);
    
    // Actualizar campos adicionales
    await db.ejecutarConsulta(
      `UPDATE usuario SET sexo = ?, nivel_actividad = ? WHERE id = ?`,
      [sexo, nivelActividad, usuarioId]
    );
    
    res.json({ 
      message: 'Usuario creado exitosamente', 
      usuarioId 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener usuario por nombre
app.get('/api/usuarios/:nombre', async (req, res) => {
  try {
    const usuario = await db.obtenerUsuarioPorNombre(req.params.nombre);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json(usuario);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generar plan nutricional
app.post('/api/generar-plan', async (req, res) => {
  try {
    const { nombre } = req.body;
    
    const usuario = await db.obtenerUsuarioPorNombre(nombre);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    const plan = await generador.generarPlanPersonalizado(usuario);
    
    res.json({
      message: 'Plan nutricional avanzado generado exitosamente',
      plan
    });
  } catch (error) {
    console.error('Error al generar plan:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener análisis nutricional detallado de un alimento
app.get('/api/alimentos/:codigo/analisis', async (req, res) => {
  try {
    const { codigo } = req.params;
    const { cantidad = 100 } = req.query;
    
    const alimento = await db.obtenerAlimentoPorCodigo(codigo);
    if (!alimento) {
      return res.status(404).json({ error: 'Alimento no encontrado' });
    }
    
    const nutrientesCalculados = generador.calcularNutrientesTotales(alimento, parseFloat(cantidad));
    
    res.json({
      alimento: nutrientesCalculados,
      recomendaciones: generador.evaluarAlimento(nutrientesCalculados)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
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

// Buscar recomendaciones nutricionales personalizadas
app.post('/api/recomendaciones', async (req, res) => {
  try {
    const { edad, peso, altura, sexo, actividad, objetivo, condiciones = [] } = req.body;
    
    const requerimientos = generador.calcularRequerimientosNutricionales(
      edad, peso, altura, sexo, actividad, objetivo
    );
    
    // Generar recomendaciones específicas
    const recomendaciones = {
      calorias: requerimientos.calorias,
      macronutrientes: requerimientos.macronutrientes,
      micronutrientes: requerimientos.micronutrientes,
      alimentosRecomendados: [],
      consejos: []
    };
    
    // Agregar consejos personalizados
    if (objetivo === 'perder') {
      recomendaciones.consejos.push('Prioriza alimentos ricos en fibra para mayor saciedad');
      recomendaciones.consejos.push('Incluye proteínas en cada comida para mantener la masa muscular');
    } else if (objetivo === 'ganar') {
      recomendaciones.consejos.push('Consume alimentos densos en calorías y nutrientes');
      recomendaciones.consejos.push('Aumenta la frecuencia de comidas');
    }
    
    if (sexo === 'F' && edad >= 15 && edad <= 50) {
      recomendaciones.consejos.push('Asegúrate de consumir suficiente hierro para prevenir anemia');
    }
    
    if (edad >= 50) {
      recomendaciones.consejos.push('Aumenta el consumo de calcio y vitamina D para la salud ósea');
    }
    
    // Buscar alimentos recomendados
    const alimentosAltoHierro = await db.buscarAlimentosPorNutriente('hierro', 3, 5);
    const alimentosAltoCalcio = await db.buscarAlimentosPorNutriente('calcio', 200, 5);
    const alimentosBalanceados = await db.obtenerAlimentosBalanceados(10);
    
    recomendaciones.alimentosRecomendados = [
      ...alimentosAltoHierro.slice(0, 3),
      ...alimentosAltoCalcio.slice(0, 3),
      ...alimentosBalanceados.slice(0, 4)
    ];
    
    res.json({
      message: 'Recomendaciones nutricionales personalizadas',
      recomendaciones
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

// Página principal (frontend)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
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
