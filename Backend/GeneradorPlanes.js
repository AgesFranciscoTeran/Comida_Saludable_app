const BaseDeDatos = require('./Base_de_datos.js');

class GeneradorPlanes {
  constructor() {
    this.db = new BaseDeDatos();
    this.alimentosUsados = new Set(); // Para evitar repetición excesiva
  }

  // Calcular calorías diarias necesarias (fórmula Mifflin-St Jeor)
  calcularCaloriasDiarias(edad, peso, altura, sexo = 'M', nivelActividad = 'moderado') {
    let bmr;
    
    if (sexo === 'M') {
      bmr = 10 * peso + 6.25 * altura - 5 * edad + 5;
    } else {
      bmr = 10 * peso + 6.25 * altura - 5 * edad - 161;
    }
    
    const factoresActividad = {
      'sedentario': 1.2,
      'ligero': 1.375,
      'moderado': 1.55,
      'activo': 1.725,
      'muy_activo': 1.9
    };
    
    return Math.round(bmr * factoresActividad[nivelActividad]);
  }

  // Distribuir nutrientes por comidas
  distribuirNutrientes(requerimientos) {
    const { calorias, macronutrientes, micronutrientes } = requerimientos;
    
    // Distribución de calorías por comida
    const distribuciones = {
      desayuno: 0.25,
      almuerzo: 0.35,
      cena: 0.30,
      snacks: 0.10
    };
    
    const resultado = {};
    
    for (const [comida, porcentaje] of Object.entries(distribuciones)) {
      resultado[comida] = {
        calorias: Math.round(calorias * porcentaje),
        proteinas: Math.round(macronutrientes.proteinas * porcentaje),
        grasas: Math.round(macronutrientes.grasas * porcentaje),
        carbohidratos: Math.round(macronutrientes.carbohidratos * porcentaje),
        micronutrientes: {}
      };
      
      // Distribuir micronutrientes
      for (const [nutriente, cantidad] of Object.entries(micronutrientes)) {
        resultado[comida].micronutrientes[nutriente] = Math.round(cantidad * porcentaje * 100) / 100;
      }
    }
    
    return resultado;
  }

  // Generar comida balanceada con todos los nutrientes
  async generarComidaBalanceada(tipoComida, targets, planId) {
    try {
      const alimentos = [];
      let nutrientesAcumulados = {
        calorias: 0,
        proteinas: 0,
        grasas: 0,
        carbohidratos: 0,
        fibra: 0,
        micronutrientes: {
          calcio: 0, hierro: 0, zinc: 0, vitamina_c: 0,
          vitamina_a: 0, folato: 0, vitamina_b12: 0,
          potasio: 0, fosforo: 0, sodio: 0,
          grasas_saturadas: 0, colesterol: 0
        }
      };
      
      const tolerancia = targets.calorias * 0.15; // 15% de tolerancia
      
      // Configuración por tipo de comida con selección inteligente
      const configuraciones = {
        desayuno: {
          prioridades: ['cereales', 'lácteos', 'frutas'],
          maxAlimentos: 4,
          estrategia: 'energia_matutina'
        },
        almuerzo: {
          prioridades: ['proteínas', 'carbohidratos', 'verduras'],
          maxAlimentos: 5,
          estrategia: 'balance_completo'
        },
        cena: {
          prioridades: ['proteínas_ligeras', 'verduras', 'granos_integrales'],
          maxAlimentos: 4,
          estrategia: 'digestibilidad'
        },
        snacks: {
          prioridades: ['frutas', 'frutos_secos'],
          maxAlimentos: 2,
          estrategia: 'saciedad'
        }
      };
      
      const config = configuraciones[tipoComida] || configuraciones.almuerzo;
      let intentos = 0;
      
      // Generar alimentos hasta alcanzar objetivos nutricionales
      while (nutrientesAcumulados.calorias < (targets.calorias - tolerancia) && 
             alimentos.length < config.maxAlimentos && 
             intentos < 15) {
        
        const alimentoSeleccionado = await this.seleccionarAlimentoInteligente(
          targets, nutrientesAcumulados, config.estrategia
        );
        
        if (alimentoSeleccionado && !alimentos.find(a => a.codigo === alimentoSeleccionado.codigo)) {
          const cantidad = this.calcularCantidadOptima(alimentoSeleccionado, targets, nutrientesAcumulados);
          
          const alimentoConNutrientes = this.calcularNutrientesTotales(alimentoSeleccionado, cantidad);
          alimentos.push(alimentoConNutrientes);
          
          // Acumular nutrientes
          this.sumarNutrientes(nutrientesAcumulados, alimentoConNutrientes);
          
          // Agregar a la base de datos
          await this.db.agregarAlimentoAPlan(planId, alimentoSeleccionado.codigo, cantidad);
        }
        
        intentos++;
      }
      
      // Calcular déficits y excesos
      const analisis = this.analizarComida(targets, nutrientesAcumulados);
      
      return {
        tipo: tipoComida,
        targets,
        nutrientesReales: nutrientesAcumulados,
        alimentos,
        analisis
      };
      
    } catch (error) {
      console.error(`Error al generar ${tipoComida}:`, error.message);
      throw error;
    }
  }

  // Calcular requerimientos nutricionales diarios
  calcularRequerimientosNutricionales(edad, peso, altura, sexo = 'M', nivelActividad = 'moderado', objetivo = 'mantener') {
    const calorias = this.calcularCaloriasDiarias(edad, peso, altura, sexo, nivelActividad);
    
    // Ajustar calorías según objetivo
    let caloriasAjustadas = calorias;
    switch (objetivo) {
      case 'perder':
        caloriasAjustadas = Math.round(calorias * 0.85); // Déficit del 15%
        break;
      case 'ganar':
        caloriasAjustadas = Math.round(calorias * 1.15); // Superávit del 15%
        break;
      default:
        caloriasAjustadas = calorias;
    }
    
    // Calcular macronutrientes (% de calorías totales)
    const proteinas = Math.round((caloriasAjustadas * 0.20) / 4); // 20% proteínas (4 kcal/g)
    const grasas = Math.round((caloriasAjustadas * 0.25) / 9); // 25% grasas (9 kcal/g)
    const carbohidratos = Math.round((caloriasAjustadas * 0.55) / 4); // 55% carbohidratos (4 kcal/g)
    
    // Micronutrientes recomendados (valores diarios de referencia)
    const micronutrientes = {
      calcio: sexo === 'F' ? 1000 : 1000, // mg
      hierro: sexo === 'F' && edad < 51 ? 18 : 8, // mg
      zinc: sexo === 'F' ? 8 : 11, // mg
      vitamina_c: 90, // mg
      vitamina_a: sexo === 'F' ? 700 : 900, // µg
      folato: 400, // µg
      vitamina_b12: 2.4, // µg
      fibra: edad < 50 ? (sexo === 'F' ? 25 : 38) : (sexo === 'F' ? 21 : 30), // g
      potasio: 3500, // mg
      fosforo: 700 // mg
    };
    
    return {
      calorias: caloriasAjustadas,
      macronutrientes: {
        proteinas,
        grasas,
        carbohidratos
      },
      micronutrientes,
      limitaciones: {
        sodio: 2300, // mg máximo
        grasas_saturadas: Math.round((caloriasAjustadas * 0.10) / 9), // máximo 10% de calorías
        colesterol: 300 // mg máximo
      }
    };
  }

  // Generar plan nutricional semanal personalizado
  async generarPlanPersonalizado(usuario) {
    try {
      // 1. Calcular requerimientos nutricionales completos
      const requerimientos = this.calcularRequerimientosNutricionales(
        usuario.edad, 
        usuario.peso, 
        usuario.altura, 
        usuario.sexo || 'M',
        usuario.nivelActividad || 'moderado',
        usuario.objetivo || 'mantener'
      );
      
      // 2. Distribuir nutrientes por comidas
      const distribucion = this.distribuirNutrientes(requerimientos);
      
      // 3. Crear el plan en la base de datos
      const nombrePlan = `Plan Semanal ${usuario.nombre} - ${new Date().toLocaleDateString()}`;
      const planId = await this.db.crearPlanNutricional(nombrePlan, usuario.id);
      
      // 4. Generar plan semanal (7 días)
      const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
      
      const planSemanal = {
        id: planId,
        nombre: nombrePlan,
        requerimientos,
        planSemanal: {},
        resumenNutricionalSemanal: {
          calorias: 0,
          proteinas: 0,
          grasas: 0,
          carbohidratos: 0,
          fibra: 0,
          micronutrientes: {}
        }
      };
      
      // Generar plan para cada día de la semana
      for (const dia of diasSemana) {
        console.log(`Generando plan para ${dia}...`);
        
        // Reiniciar seguimiento de alimentos para cada día para permitir variedad
        this.alimentosUsados.clear();
        
        const planDiario = {
          dia,
          comidas: {},
          resumenNutricional: {
            calorias: 0,
            proteinas: 0,
            grasas: 0,
            carbohidratos: 0,
            fibra: 0,
            micronutrientes: {}
          }
        };
        
        // Generar cada comida del día con variedad
        for (const [comida, targets] of Object.entries(distribucion)) {
          console.log(`Generando ${comida} para ${dia}...`);
          planDiario.comidas[comida] = await this.generarComidaBalanceada(comida, targets, planId);
          
          // Acumular valores nutricionales del día
          this.acumularNutrientes(planDiario.resumenNutricional, planDiario.comidas[comida]);
        }
        
        // Calcular cumplimiento del día
        planDiario.cumplimiento = this.calcularCumplimiento(planDiario.resumenNutricional, requerimientos);
        
        // Agregar día al plan semanal
        planSemanal.planSemanal[dia] = planDiario;
        
        // Acumular valores nutricionales semanales
        this.acumularNutrientes(planSemanal.resumenNutricionalSemanal, planDiario.resumenNutricional);
      }
      
      // 5. Calcular promedios semanales
      planSemanal.promedioSemanal = this.calcularPromedioSemanal(planSemanal.resumenNutricionalSemanal);
      planSemanal.cumplimientoSemanal = this.calcularCumplimiento(planSemanal.promedioSemanal, requerimientos);
      
      return planSemanal;
      
    } catch (error) {
      console.error('Error al generar plan:', error.message);
      throw error;
    }
  }

  // Seleccionar alimento de forma inteligente según estrategia
  async seleccionarAlimentoInteligente(targets, acumulados, estrategia) {
    try {
      // Calcular qué nutrientes necesitamos más
      const deficit = {
        calorias: targets.calorias - acumulados.calorias,
        proteinas: targets.proteinas - acumulados.proteinas,
        grasas: targets.grasas - acumulados.grasas,
        carbohidratos: targets.carbohidratos - acumulados.carbohidratos
      };
      
      let query = `
        SELECT a.*, 
               (a.energia_kcal) as score_calorias,
               (a.proteina_g * 4) as score_proteinas,
               (a.grasa_total_g * 9) as score_grasas,
               (a.carbohidratos_g * 4) as score_carbohidratos
        FROM alimentos a 
        WHERE a.energia_kcal > 0 
      `;
      
      // Aplicar estrategia específica
      switch (estrategia) {
        case 'energia_matutina':
          query += ` AND (a.carbohidratos_g > 10 OR a.proteina_g > 5)`;
          break;
        case 'balance_completo':
          query += ` AND a.proteina_g > 5 AND a.energia_kcal > 50`;
          break;
        case 'digestibilidad':
          query += ` AND a.fibra_g < 8 AND a.grasa_total_g < 15`;
          break;
        case 'saciedad':
          query += ` AND (a.fibra_g > 2 OR a.proteina_g > 3)`;
          break;
      }
      
      // Priorizar según déficit más importante
      const maxDeficit = Math.max(
        deficit.proteinas * 4, 
        deficit.grasas * 9, 
        deficit.carbohidratos * 4
      );
      
      if (deficit.proteinas * 4 === maxDeficit) {
        query += ` ORDER BY a.proteina_g DESC`;
      } else if (deficit.grasas * 9 === maxDeficit) {
        query += ` ORDER BY a.grasa_total_g DESC`;
      } else {
        query += ` ORDER BY a.carbohidratos_g DESC`;
      }
      
      query += ` LIMIT 30`;
      
      const alimentos = await this.db.ejecutarConsulta(query);
      
      if (alimentos.length > 0) {
        // Filtrar alimentos para evitar repetición excesiva
        let alimentosDisponibles = alimentos.filter(a => !this.alimentosUsados.has(a.codigo));
        
        // Si no hay alimentos nuevos, permitir reutilizar después de reiniciar el seguimiento
        if (alimentosDisponibles.length === 0) {
          this.alimentosUsados.clear();
          alimentosDisponibles = alimentos;
        }
        
        // Seleccionar uno de los mejores candidatos aleatoriamente
        const topCandidatos = alimentosDisponibles.slice(0, Math.min(5, alimentosDisponibles.length));
        const alimentoSeleccionado = topCandidatos[Math.floor(Math.random() * topCandidatos.length)];
        
        // Marcar como usado
        this.alimentosUsados.add(alimentoSeleccionado.codigo);
        
        return alimentoSeleccionado;
      }
      
      return null;
      
    } catch (error) {
      console.error('Error al seleccionar alimento:', error.message);
      return null;
    }
  }

  // Calcular cantidad óptima de alimento
  calcularCantidadOptima(alimento, targets, acumulados) {
    const caloriasRestantes = targets.calorias - acumulados.calorias;
    const caloriasPor100g = parseFloat(alimento.energia_kcal);
    
    if (caloriasPor100g <= 0) return 50;
    
    // Calcular cantidad ideal basada en calorías restantes
    const cantidadIdeal = (caloriasRestantes / caloriasPor100g) * 100;
    
    // Aplicar límites razonables según el tipo de alimento
    let min = 30, max = 150;
    
    // Ajustar límites según densidad calórica
    if (caloriasPor100g > 400) { // Alta densidad (frutos secos, aceites)
      min = 10; max = 50;
    } else if (caloriasPor100g > 200) { // Densidad media (carnes, quesos)
      min = 50; max = 120;
    } else if (caloriasPor100g < 50) { // Baja densidad (verduras)
      min = 100; max = 300;
    }
    
    return Math.max(min, Math.min(max, Math.round(cantidadIdeal)));
  }

  // Calcular todos los nutrientes de un alimento para una cantidad específica
  calcularNutrientesTotales(alimento, cantidad) {
    const factor = cantidad / 100; // Factor de conversión desde 100g
    
    return {
      ...alimento,
      cantidad,
      nutrientes: {
        calorias: Math.round((parseFloat(alimento.energia_kcal) || 0) * factor),
        proteinas: Math.round((parseFloat(alimento.proteina_g) || 0) * factor * 100) / 100,
        grasas: Math.round((parseFloat(alimento.grasa_total_g) || 0) * factor * 100) / 100,
        carbohidratos: Math.round((parseFloat(alimento.carbohidratos_g) || 0) * factor * 100) / 100,
        fibra: Math.round((parseFloat(alimento.fibra_g) || 0) * factor * 100) / 100,
        grasas_saturadas: Math.round((parseFloat(alimento.ag_saturados_g) || 0) * factor * 100) / 100,
        colesterol: Math.round((parseFloat(alimento.colesterol_mg) || 0) * factor * 100) / 100,
        calcio: Math.round((parseFloat(alimento.calcio_mg) || 0) * factor * 100) / 100,
        fosforo: Math.round((parseFloat(alimento.fosforo_mg) || 0) * factor * 100) / 100,
        hierro: Math.round((parseFloat(alimento.hierro_mg) || 0) * factor * 100) / 100,
        potasio: Math.round((parseFloat(alimento.potasio_mg) || 0) * factor * 100) / 100,
        sodio: Math.round((parseFloat(alimento.sodio_mg) || 0) * factor * 100) / 100,
        zinc: Math.round((parseFloat(alimento.zinc_mg) || 0) * factor * 100) / 100,
        vitamina_c: Math.round((parseFloat(alimento.vitc_mg) || 0) * factor * 100) / 100,
        vitamina_a: Math.round((parseFloat(alimento.vita_ug) || 0) * factor * 100) / 100,
        folato: Math.round((parseFloat(alimento.folato_ug) || 0) * factor * 100) / 100,
        vitamina_b12: Math.round((parseFloat(alimento.vitb12_ug) || 0) * factor * 100) / 100
      }
    };
  }

  // Sumar nutrientes a los acumulados
  sumarNutrientes(acumulados, alimento) {
    const nutrientes = alimento.nutrientes;
    
    acumulados.calorias += nutrientes.calorias;
    acumulados.proteinas += nutrientes.proteinas;
    acumulados.grasas += nutrientes.grasas;
    acumulados.carbohidratos += nutrientes.carbohidratos;
    acumulados.fibra += nutrientes.fibra;
    
    // Micronutrientes
    acumulados.micronutrientes.calcio += nutrientes.calcio;
    acumulados.micronutrientes.hierro += nutrientes.hierro;
    acumulados.micronutrientes.zinc += nutrientes.zinc;
    acumulados.micronutrientes.vitamina_c += nutrientes.vitamina_c;
    acumulados.micronutrientes.vitamina_a += nutrientes.vitamina_a;
    acumulados.micronutrientes.folato += nutrientes.folato;
    acumulados.micronutrientes.vitamina_b12 += nutrientes.vitamina_b12;
    acumulados.micronutrientes.potasio += nutrientes.potasio;
    acumulados.micronutrientes.fosforo += nutrientes.fosforo;
    acumulados.micronutrientes.sodio += nutrientes.sodio;
    acumulados.micronutrientes.grasas_saturadas += nutrientes.grasas_saturadas;
    acumulados.micronutrientes.colesterol += nutrientes.colesterol;
  }

  // Analizar comida generada vs objetivos
  analizarComida(targets, reales) {
    const analisis = {
      calorias: this.calcularPorcentajeCumplimiento(reales.calorias, targets.calorias),
      proteinas: this.calcularPorcentajeCumplimiento(reales.proteinas, targets.proteinas),
      grasas: this.calcularPorcentajeCumplimiento(reales.grasas, targets.grasas),
      carbohidratos: this.calcularPorcentajeCumplimiento(reales.carbohidratos, targets.carbohidratos),
      micronutrientes: {}
    };
    
    // Analizar micronutrientes
    for (const [nutriente, objetivo] of Object.entries(targets.micronutrientes)) {
      const real = reales.micronutrientes[nutriente] || 0;
      analisis.micronutrientes[nutriente] = this.calcularPorcentajeCumplimiento(real, objetivo);
    }
    
    return analisis;
  }

  // Calcular porcentaje de cumplimiento
  calcularPorcentajeCumplimiento(real, objetivo) {
    if (objetivo === 0) return 100;
    const porcentaje = Math.round((real / objetivo) * 100);
    return {
      real,
      objetivo,
      porcentaje,
      cumple: porcentaje >= 80 && porcentaje <= 120, // Rango aceptable 80-120%
      estado: porcentaje < 80 ? 'deficiente' : porcentaje > 120 ? 'exceso' : 'optimo'
    };
  }

  // Acumular nutrientes para el resumen del plan
  acumularNutrientes(resumen, comida) {
    // Verificar si es un objeto comida con nutrientesReales o un resumen nutricional directo
    const nutrientes = comida.nutrientesReales || comida;
    
    if (!nutrientes) {
      console.warn('No se encontraron nutrientes para acumular');
      return;
    }
    
    resumen.calorias += nutrientes.calorias || 0;
    resumen.proteinas += nutrientes.proteinas || 0;
    resumen.grasas += nutrientes.grasas || 0;
    resumen.carbohidratos += nutrientes.carbohidratos || 0;
    resumen.fibra += nutrientes.fibra || 0;
    
    // Inicializar micronutrientes si no existen
    if (!resumen.micronutrientes) {
      resumen.micronutrientes = {};
    }
    
    if (nutrientes.micronutrientes) {
      for (const [nutriente, valor] of Object.entries(nutrientes.micronutrientes)) {
        if (!resumen.micronutrientes[nutriente]) {
          resumen.micronutrientes[nutriente] = 0;
        }
        resumen.micronutrientes[nutriente] += valor || 0;
      }
    }
  }

  // Calcular cumplimiento general del plan
  calcularCumplimiento(resumen, requerimientos) {
    const cumplimiento = {
      general: 0,
      macronutrientes: {},
      micronutrientes: {},
      limitaciones: {}
    };
    
    // Macronutrientes
    cumplimiento.macronutrientes.calorias = this.calcularPorcentajeCumplimiento(resumen.calorias, requerimientos.calorias);
    cumplimiento.macronutrientes.proteinas = this.calcularPorcentajeCumplimiento(resumen.proteinas, requerimientos.macronutrientes.proteinas);
    cumplimiento.macronutrientes.grasas = this.calcularPorcentajeCumplimiento(resumen.grasas, requerimientos.macronutrientes.grasas);
    cumplimiento.macronutrientes.carbohidratos = this.calcularPorcentajeCumplimiento(resumen.carbohidratos, requerimientos.macronutrientes.carbohidratos);
    
    // Micronutrientes
    for (const [nutriente, objetivo] of Object.entries(requerimientos.micronutrientes)) {
      const real = resumen.micronutrientes[nutriente] || 0;
      cumplimiento.micronutrientes[nutriente] = this.calcularPorcentajeCumplimiento(real, objetivo);
    }
    
    // Limitaciones (valores que NO deben excederse)
    cumplimiento.limitaciones.sodio = {
      real: resumen.micronutrientes.sodio || 0,
      limite: requerimientos.limitaciones.sodio,
      cumple: (resumen.micronutrientes.sodio || 0) <= requerimientos.limitaciones.sodio
    };
    
    cumplimiento.limitaciones.grasas_saturadas = {
      real: resumen.micronutrientes.grasas_saturadas || 0,
      limite: requerimientos.limitaciones.grasas_saturadas,
      cumple: (resumen.micronutrientes.grasas_saturadas || 0) <= requerimientos.limitaciones.grasas_saturadas
    };
    
    // Calcular puntuación general (0-100)
    const scores = [
      cumplimiento.macronutrientes.calorias.porcentaje,
      cumplimiento.macronutrientes.proteinas.porcentaje,
      cumplimiento.macronutrientes.grasas.porcentaje,
      cumplimiento.macronutrientes.carbohidratos.porcentaje
    ];
    
    cumplimiento.general = Math.round(scores.reduce((a, b) => a + b) / scores.length);
    
    return cumplimiento;
  }

  // Calcular promedio nutricional semanal
  calcularPromedioSemanal(resumenSemanal) {
    const promedio = {
      calorias: Math.round(resumenSemanal.calorias / 7),
      proteinas: Math.round(resumenSemanal.proteinas / 7),
      grasas: Math.round(resumenSemanal.grasas / 7),
      carbohidratos: Math.round(resumenSemanal.carbohidratos / 7),
      fibra: Math.round((resumenSemanal.fibra / 7) * 10) / 10,
      micronutrientes: {}
    };

    // Calcular promedios de micronutrientes
    for (const [nutriente, valor] of Object.entries(resumenSemanal.micronutrientes)) {
      promedio.micronutrientes[nutriente] = Math.round((valor / 7) * 100) / 100;
    }

    return promedio;
  }

  // Obtener plan completo con detalles mejorado
  async obtenerPlanCompleto(planId) {
    try {
      // Obtener información del plan
      const planInfo = await this.db.ejecutarConsulta(
        `SELECT p.*, u.nombre as usuario_nombre 
         FROM plan_nutricional p 
         LEFT JOIN usuario u ON u.plan_nutricional_id = p.id 
         WHERE p.id = ?`, 
        [planId]
      );
      
      if (!planInfo.length) {
        throw new Error('Plan no encontrado');
      }
      
      // Obtener detalles del plan con información nutricional completa
      const detalles = await this.db.ejecutarConsulta(
        `SELECT dp.*, a.*
         FROM detalle_plan dp
         JOIN alimentos a ON dp.alimento_codigo = a.codigo
         WHERE dp.plan_nutricional_id = ?
         ORDER BY dp.id`, 
        [planId]
      );
      
      // Calcular nutrientes totales para cada alimento
      const alimentosConNutrientes = detalles.map(detalle => 
        this.calcularNutrientesTotales(detalle, detalle.cantidad)
      );
      
      return {
        plan: planInfo[0],
        alimentos: alimentosConNutrientes,
        resumenNutricional: this.calcularResumenNutricional(alimentosConNutrientes)
      };
      
    } catch (error) {
      console.error('Error al obtener plan completo:', error.message);
      throw error;
    }
  }

  // Calcular resumen nutricional de una lista de alimentos
  calcularResumenNutricional(alimentos) {
    const resumen = {
      calorias: 0,
      proteinas: 0,
      grasas: 0,
      carbohidratos: 0,
      fibra: 0,
      micronutrientes: {
        calcio: 0, hierro: 0, zinc: 0, vitamina_c: 0,
        vitamina_a: 0, folato: 0, vitamina_b12: 0,
        potasio: 0, fosforo: 0, sodio: 0,
        grasas_saturadas: 0, colesterol: 0
      }
    };
    
    alimentos.forEach(alimento => {
      if (alimento.nutrientes) {
        resumen.calorias += alimento.nutrientes.calorias;
        resumen.proteinas += alimento.nutrientes.proteinas;
        resumen.grasas += alimento.nutrientes.grasas;
        resumen.carbohidratos += alimento.nutrientes.carbohidratos;
        resumen.fibra += alimento.nutrientes.fibra;
        
        for (const [nutriente, valor] of Object.entries(alimento.nutrientes)) {
          if (resumen.micronutrientes.hasOwnProperty(nutriente)) {
            resumen.micronutrientes[nutriente] += valor;
          }
        }
      }
    });
    
    // Redondear valores
    resumen.calorias = Math.round(resumen.calorias);
    resumen.proteinas = Math.round(resumen.proteinas * 100) / 100;
    resumen.grasas = Math.round(resumen.grasas * 100) / 100;
    resumen.carbohidratos = Math.round(resumen.carbohidratos * 100) / 100;
    resumen.fibra = Math.round(resumen.fibra * 100) / 100;
    
    for (const [nutriente, valor] of Object.entries(resumen.micronutrientes)) {
      resumen.micronutrientes[nutriente] = Math.round(valor * 100) / 100;
    }
    
    return resumen;
  }

  // Evaluar alimento individualmente
  evaluarAlimento(alimento) {
    const nutrientes = alimento.nutrientes;
    const evaluacion = {
      puntuacion: 20, // Puntuación base para todos los alimentos
      fortalezas: [],
      debilidades: [],
      recomendaciones: []
    };
    
    // Evaluar densidad nutricional
    const densidadProteica = (nutrientes.proteinas * 4) / nutrientes.calorias;
    const densidadFibra = nutrientes.fibra / (nutrientes.calorias / 100);
    
    // Proteínas
    if (densidadProteica > 0.2) {
      evaluacion.fortalezas.push('Excelente fuente de proteína');
      evaluacion.puntuacion += 20;
    } else if (densidadProteica > 0.1) {
      evaluacion.fortalezas.push('Buena fuente de proteína');
      evaluacion.puntuacion += 10;
    } else if (densidadProteica > 0.05) {
      evaluacion.puntuacion += 5;
    }
    
    // Fibra
    if (densidadFibra > 3) {
      evaluacion.fortalezas.push('Rico en fibra');
      evaluacion.puntuacion += 15;
    } else if (densidadFibra > 1.5) {
      evaluacion.fortalezas.push('Contiene fibra');
      evaluacion.puntuacion += 8;
    } else if (densidadFibra > 0.5) {
      evaluacion.puntuacion += 3;
    }
    
    // Evaluar carbohidratos (energía)
    if (nutrientes.carbohidratos > 15) {
      evaluacion.fortalezas.push('Buena fuente de energía');
      evaluacion.puntuacion += 5;
    }
    
    // Evaluar micronutrientes destacados
    const vitaminasDestacadas = [];
    if (nutrientes.vitamina_c > 30) vitaminasDestacadas.push('Vitamina C');
    if (nutrientes.vitamina_a > 300) vitaminasDestacadas.push('Vitamina A');
    if (nutrientes.folato > 100) vitaminasDestacadas.push('Folato');
    if (nutrientes.vitamina_b12 > 1) vitaminasDestacadas.push('Vitamina B12');
    
    if (vitaminasDestacadas.length > 0) {
      evaluacion.fortalezas.push(`Rico en: ${vitaminasDestacadas.join(', ')}`);
      evaluacion.puntuacion += vitaminasDestacadas.length * 10;
    }
    
    // Evaluar minerales
    const mineralesDestacados = [];
    if (nutrientes.calcio > 200) mineralesDestacados.push('Calcio');
    if (nutrientes.hierro > 3) mineralesDestacados.push('Hierro');
    if (nutrientes.zinc > 2) mineralesDestacados.push('Zinc');
    if (nutrientes.potasio > 400) mineralesDestacados.push('Potasio');
    
    if (mineralesDestacados.length > 0) {
      evaluacion.fortalezas.push(`Buena fuente de: ${mineralesDestacados.join(', ')}`);
      evaluacion.puntuacion += mineralesDestacados.length * 8;
    }
    
    // Evaluar aspectos negativos de forma gradual
    if (nutrientes.sodio > 600) {
      evaluacion.debilidades.push('Muy alto contenido en sodio');
      evaluacion.puntuacion -= 15;
    } else if (nutrientes.sodio > 400) {
      evaluacion.debilidades.push('Alto contenido en sodio');
      evaluacion.puntuacion -= 8;
    } else if (nutrientes.sodio > 200) {
      evaluacion.debilidades.push('Moderado contenido en sodio');
      evaluacion.puntuacion -= 3;
    }
    
    if (nutrientes.grasas_saturadas > 8) {
      evaluacion.debilidades.push('Muy alto en grasas saturadas');
      evaluacion.puntuacion -= 12;
    } else if (nutrientes.grasas_saturadas > 5) {
      evaluacion.debilidades.push('Alto en grasas saturadas');
      evaluacion.puntuacion -= 6;
    } else if (nutrientes.grasas_saturadas > 2) {
      evaluacion.puntuacion -= 2;
    }
    
    if (nutrientes.colesterol > 150) {
      evaluacion.debilidades.push('Muy alto en colesterol');
      evaluacion.puntuacion -= 8;
    } else if (nutrientes.colesterol > 100) {
      evaluacion.debilidades.push('Alto en colesterol');
      evaluacion.puntuacion -= 4;
    }
    
    // Evaluar calorías por gramo (densidad calórica)
    const densidadCalorica = nutrientes.calorias / 100; // calorías por 100g
    if (densidadCalorica > 400) {
      evaluacion.debilidades.push('Muy alto en calorías');
      evaluacion.puntuacion -= 5;
    } else if (densidadCalorica > 250) {
      evaluacion.debilidades.push('Alto en calorías');
      evaluacion.puntuacion -= 2;
    }
    
    // Generar recomendaciones más específicas
    if (densidadProteica > 0.15) {
      evaluacion.recomendaciones.push('Excelente para deportistas y desarrollo muscular');
    } else if (densidadProteica > 0.08) {
      evaluacion.recomendaciones.push('Contribuye al mantenimiento muscular');
    }
    
    if (densidadFibra > 2) {
      evaluacion.recomendaciones.push('Ideal para la salud digestiva');
    } else if (densidadFibra > 0.5) {
      evaluacion.recomendaciones.push('Aporta algo de fibra');
    }
    
    if (nutrientes.calcio > 150) {
      evaluacion.recomendaciones.push('Beneficioso para la salud ósea');
    }
    
    if (nutrientes.hierro > 2) {
      evaluacion.recomendaciones.push('Útil para prevenir anemia');
    }
    
    if (nutrientes.carbohidratos > 20) {
      evaluacion.recomendaciones.push('Proporciona energía rápida');
    }
    
    // Asegurar que la puntuación no sea negativa
    evaluacion.puntuacion = Math.max(5, evaluacion.puntuacion);
    
    // Categorizar puntuación con descripciones más claras
    if (evaluacion.puntuacion >= 70) {
      evaluacion.categoria = 'Excelente';
      evaluacion.descripcion = 'Alimento muy nutritivo y saludable';
    } else if (evaluacion.puntuacion >= 50) {
      evaluacion.categoria = 'Bueno';
      evaluacion.descripcion = 'Alimento nutritivo con buen perfil nutricional';
    } else if (evaluacion.puntuacion >= 30) {
      evaluacion.categoria = 'Regular';
      evaluacion.descripcion = 'Alimento con valor nutricional moderado';
    } else if (evaluacion.puntuacion >= 15) {
      evaluacion.categoria = 'Básico';
      evaluacion.descripcion = 'Alimento con valor nutricional limitado';
    } else {
      evaluacion.categoria = 'Procesado';
      evaluacion.descripcion = 'Alimento altamente procesado, consumir con moderación';
    }
    
    return evaluacion;
  }

  // Comparar múltiples alimentos
  compararAlimentos(alimentos) {
    const comparacion = {
      mejor_en: {},
      resumen: [],
      recomendacion: ''
    };
    
    const nutrientes = ['calorias', 'proteinas', 'grasas', 'carbohidratos', 'fibra', 
                       'calcio', 'hierro', 'zinc', 'vitamina_c', 'vitamina_a'];
    
    // Encontrar el mejor en cada nutriente
    nutrientes.forEach(nutriente => {
      let mejorValor = 0;
      let mejorAlimento = null;
      
      alimentos.forEach(alimento => {
        const valor = alimento.nutrientes[nutriente] || 0;
        if (valor > mejorValor) {
          mejorValor = valor;
          mejorAlimento = alimento.nombre;
        }
      });
      
      if (mejorAlimento) {
        comparacion.mejor_en[nutriente] = {
          alimento: mejorAlimento,
          valor: mejorValor
        };
      }
    });
    
    // Generar resumen para cada alimento
    alimentos.forEach(alimento => {
      const evaluacion = this.evaluarAlimento(alimento);
      comparacion.resumen.push({
        nombre: alimento.nombre,
        puntuacion: evaluacion.puntuacion,
        categoria: evaluacion.categoria,
        destacado_en: evaluacion.fortalezas.slice(0, 2)
      });
    });
    
    // Ordenar por puntuación
    comparacion.resumen.sort((a, b) => b.puntuacion - a.puntuacion);
    
    // Generar recomendación
    if (comparacion.resumen.length > 0) {
      const mejor = comparacion.resumen[0];
      comparacion.recomendacion = `${mejor.nombre} es la mejor opción general con ${mejor.puntuacion} puntos (${mejor.categoria})`;
    }
    
    return comparacion;
  }
}

module.exports = GeneradorPlanes;
