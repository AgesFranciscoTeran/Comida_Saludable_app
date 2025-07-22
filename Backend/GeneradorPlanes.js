const BaseDeDatos = require('./Base_de_datos.js');

class GeneradorPlanes {
  constructor() {
    this.db = new BaseDeDatos();
    this.alimentosUsados = new Set();
  }
  async generarPlan(edad, peso, altura, sexo) {
    // 1) Calculo de requerimientos diarios
    const requerimientos = this.calcularRequerimientosNutricionales(edad, peso, altura, sexo);

    // 2) Inicializo el plan
    const plan = {
      requerimientos,
      planSemanal: {},
      // acumulado semanal
      resumenNutricionalSemanal: {
        calorias: 0,
        proteinas: 0,
        grasas: 0,
        carbohidratos: 0,
        fibra: 0,
        micronutrientes: { ...Object.fromEntries(Object.keys(requerimientos.micronutrientes).map(m => [m, 0])) }
  }
  };

    const dias = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
    for (const dia of dias) {
      // genero un diario para cada día
      const diario = {
        comidas: {},
        resumenNutricional: {
          calorias: 0,
          proteinas: 0,
          grasas: 0,
          carbohidratos: 0,
          fibra: 0,
          micronutrientes: { ...Object.fromEntries(Object.keys(requerimientos.micronutrientes).map(m => [m, 0])) }
    },
      cumplimiento: {}
    };

      // por cada tipo de comida (ej. desayuno, comida, cena, snacks…)
      for (const tipo of Object.keys(requerimientos.comidas)) {
        // selecciono comidas hasta cumplir macros
        const comidaGenerada = await this.seleccionarComida(tipo, requerimientos.comidas[tipo]);
        diario.comidas[tipo] = comidaGenerada;

        // acumulo al resumen diario
        this.acumularNutrientes(diario.resumenNutricional, comidaGenerada.nutrientesReales);
      }

      // calculo cumplimiento diario (opcional)
      diario.cumplimiento = this.calcularCumplimiento(diario.resumenNutricional, {
        ...requerimientos,
        comidas: undefined  // sólo macros
      });

      plan.planSemanal[dia] = diario;
      // acumulo al resumen semanal
      this.acumularNutrientes(plan.resumenNutricionalSemanal, diario.resumenNutricional);
    }

    // --- cálculo de cumplimiento semanal (objetivos×7) ---
    const objetivosSemanales = {
      calorias: requerimientos.calorias * 7,
      proteinas: requerimientos.proteinas * 7,
      grasas: requerimientos.grasas * 7,
      carbohidratos: requerimientos.carbohidratos * 7,
      fibra: requerimientos.fibra * 7,
      micronutrientes: { }
    };
    for (const m in requerimientos.micronutrientes) {
      objetivosSemanales.micronutrientes[m] = requerimientos.micronutrientes[m] * 7;
    }
    plan.cumplimiento = this.calcularCumplimiento(
        plan.resumenNutricionalSemanal,
        objetivosSemanales
    );

    return plan;
  }
  calcularNutrientesTotales(alimento, cantidad) {
    const factor = cantidad / 100;
    return {
      codigo: alimento.codigo,
      nombre: alimento.nombre,
      cantidad,
      nutrientes: {
        calorias: Math.round(alimento.energia_kcal * factor),
        proteinas: Math.round(alimento.proteina_g * factor * 10) / 10,
        grasas:    Math.round(alimento.grasa_total_g * factor * 10) / 10,
        carbohidratos: Math.round(alimento.carbohidratos_g * factor * 10) / 10,
        fibra:     Math.round((alimento.fibra_g || 0) * factor * 10) / 10,
        sodio:     Math.round((alimento.sodio_mg || 0) * factor * 10) / 10,
        calcio:    Math.round((alimento.calcio_mg || 0) * factor * 10) / 10,
        hierro:    Math.round((alimento.hierro_mg || 0) * factor * 10) / 10,
        zinc:      Math.round((alimento.zinc_mg || 0) * factor * 10) / 10,
        vitamina_c: Math.round((alimento.vitc_mg || 0) * factor * 10) / 10,
        //…otros micronutrientes…
      }
    };
  }

  // 2) Suma los nutrientes de un alimento al acumulado
  acumularNutrientes(acumulados, alimConNut) {
    // Log de entrada
    console.log('🛠 [acumularNutrientes] acumulados recibidos:', JSON.stringify(acumulados));
    console.log('🛠 [acumularNutrientes] alimConNut recibido   :', JSON.stringify(alimConNut));

    // Elegimos fuente de nutrientes (puede venir en varias formas)
    const fuente = alimConNut.nutrientesReales
        || alimConNut.nutrientes
        || alimConNut;

    console.log('🛠 [acumularNutrientes] fuente elegida      :', JSON.stringify(fuente));

    // Suma de macros
    acumulados.calorias      += fuente.calorias     || 0;
    acumulados.proteinas     += fuente.proteinas    || 0;
    acumulados.grasas        += fuente.grasas       || 0;
    acumulados.carbohidratos += fuente.carbohidratos|| 0;
    acumulados.fibra         += fuente.fibra        || 0;

    // Suma de micronutrientes
    for (const [mic, val] of Object.entries(fuente.micronutrientes || {})) {
      if (acumulados.micronutrientes[mic] != null) {
        acumulados.micronutrientes[mic] += val;
      }
    }

    // Log de salida
    console.log('🛠 [acumularNutrientes] acumulados quedan  :', JSON.stringify(acumulados));
  }

  // 3) Compara objetivos vs. reales y devuelve un mini-análisis
  analizarComida(targets, reales) {
    const result = {};
    for (const key of ['calorias','proteinas','grasas','carbohidratos']) {
      const t = targets[key];
      const r = reales[key];
      const pct = Math.round((r / t) * 100);
      result[key] = { porcentaje: pct, cumple: pct >= 90 && pct <= 110 };
    }
    return result;
  }

  // 4) Calcula el cumplimiento general de un día o semana
  calcularCumplimiento(resumen, requerimientos) {
    const keys = ['calorias','proteinas','grasas','carbohidratos'];
    let totalPct = 0;
    for (const k of keys) {
      const pct = Math.min(100, Math.round((resumen[k] / requerimientos.macronutrientes[k]) * 100));
      totalPct += pct;
    }
    return {
      general: Math.round(totalPct / keys.length),
      macronutrientes: keys.reduce((acc,k) => {
        acc[k] = { porcentaje: Math.min(100, Math.round((resumen[k] / requerimientos.macronutrientes[k]) * 100)) };
        return acc;
      }, {}),
      micronutrientes: {} // si quieres analizar micronutrientes igual
    };
  }
  calcularCantidadOptima(alimento, targets, acumulados) {
    const caloriasRestantes = targets.calorias - acumulados.calorias;
    const caloriasPor100g  = parseFloat(alimento.energia_kcal) || 0;
    if (caloriasPor100g <= 0) return 50;

    // Cantidad ideal en gramos
    const cantidadIdeal = (caloriasRestantes / caloriasPor100g) * 100;

    // Límites razonables
    let min = 30, max = 150;
    if (caloriasPor100g > 400)      { min = 10;  max = 50;  }
    else if (caloriasPor100g > 200) { min = 50;  max = 120; }
    else if (caloriasPor100g < 50)  { min = 100; max = 300; }

    return Math.max(min, Math.min(max, Math.round(cantidadIdeal)));
  }
  calcularCaloriasDiarias(edad, peso, altura, sexo = 'M') {
    let bmr = sexo === 'M'
        ? 10 * peso + 6.25 * altura - 5 * edad + 5
        : 10 * peso + 6.25 * altura - 5 * edad - 161;
    return Math.round(bmr * 1.5); // Valor fijo para banco de alimentos
  }

  calcularRequerimientosNutricionales(edad, peso, altura, sexo = 'M') {
    const calorias = this.calcularCaloriasDiarias(edad, peso, altura, sexo);
    let caloriasAjustadas = calorias;

    const proteinas = Math.round((caloriasAjustadas * 0.20) / 4);
    const grasas = Math.round((caloriasAjustadas * 0.25) / 9);
    const carbohidratos = Math.round((caloriasAjustadas * 0.55) / 4);

    const micronutrientes = {
      calcio: 1000,
      hierro: sexo === 'F' && edad < 51 ? 18 : 8,
      zinc: sexo === 'F' ? 8 : 11,
      vitamina_c: 90,
      vitamina_a: sexo === 'F' ? 700 : 900,
      folato: 400,
      vitamina_b12: 2.4,
      fibra: edad < 50 ? (sexo === 'F' ? 25 : 38) : (sexo === 'F' ? 21 : 30),
      potasio: 3500,
      fosforo: 700
    };

    return {
      calorias: caloriasAjustadas,
      macronutrientes: { proteinas, grasas, carbohidratos },
      micronutrientes,
      limitaciones: {
        sodio: 2300,
        grasas_saturadas: Math.round((caloriasAjustadas * 0.10) / 9),
        colesterol: 300
      }
    };
  }

  distribuirNutrientes(reqs) {
    const distribuciones = {
      desayuno: 0.25,
      almuerzo: 0.35,
      cena: 0.30,
      snacks: 0.10
    };

    const resultado = {};
    for (const [comida, porc] of Object.entries(distribuciones)) {
      resultado[comida] = {
        calorias: Math.round(reqs.calorias * porc),
        proteinas: Math.round(reqs.macronutrientes.proteinas * porc),
        grasas: Math.round(reqs.macronutrientes.grasas * porc),
        carbohidratos: Math.round(reqs.macronutrientes.carbohidratos * porc),
        micronutrientes: {}
      };
      for (const [n, val] of Object.entries(reqs.micronutrientes)) {
        resultado[comida].micronutrientes[n] = Math.round(val * porc * 100) / 100;
      }
    }
    return resultado;
  }

  async generarComidaBalanceada(tipoComida, targets, planId, opciones = {}) {
    const {
      preferencias = [],
      condiciones  = [],
      diaIndice    = 0
    } = opciones;

    // 1) Obtener candidatos
    let candidatos = await this.db.obtenerAlimentosFiltrados(
        preferencias,
        condiciones,
        100
    );
    // 🔄 Fallback: si no hay ninguno tras filtros, quito filtros
        if (!candidatos.length) {
            console.warn(`GeneradorPlanes: sin candidatos para ${tipoComida}, quitando filtros…`);
            candidatos = await this.db.obtenerAlimentosFiltrados([], [], 100);
            if (!candidatos.length) {
                throw new Error(`Sin ningún alimento disponible para ${tipoComida}`);
              }
          }

    // 2) Rotar para variar día a día
    const offset = diaIndice % candidatos.length;
    candidatos = candidatos.slice(offset).concat(candidatos.slice(0, offset));

    // 3) Seleccionar hasta acercarse al objetivo
    const tolerancia = targets.calorias * 0.15;
    const seleccion  = [];
    const acumulados = { calorias:0, proteinas:0, grasas:0, carbohidratos:0, fibra:0, micronutrientes: Object.fromEntries(Object.keys(targets.micronutrientes||{}).map(m=>[m,0])) };

    for (let i = 0; i < candidatos.length && acumulados.calorias < (targets.calorias - tolerancia) && seleccion.length < 5; i++) {
      const cand = candidatos[i];
      if (this.alimentosUsados.has(cand.codigo)) continue;
      this.alimentosUsados.add(cand.codigo);

      // calculo cantidad ideal sin pasarse
      const cantidad = this.calcularCantidadOptima(cand, targets, acumulados);
      const alimTot  = this.calcularNutrientesTotales(cand, cantidad);

      // guardar en BD
      await this.db.agregarAlimentoAPlan(planId, cand.codigo, cantidad);

      seleccion.push(alimTot);
      this.acumularNutrientes(acumulados, alimTot);
    }

    return {
      tipo:            tipoComida,
      targets,
      nutrientesReales: acumulados,
      alimentos:       seleccion,
      analisis:        this.analizarComida(targets, acumulados)
    };
  }

  async generarPlanPersonalizado(usuario) {
    const { id: usuarioId, nombre, edad, peso, altura, sexo, preferencias = [], condiciones = [] } = usuario;

    // 1) Requerimientos y reparto diario
    const reqs       = this.calcularRequerimientosNutricionales(edad, peso, altura, sexo);
    const distrib    = this.distribuirNutrientes(reqs);

    // 2) Crear cabecera de plan en BD
    const nombrePlan = `Plan de ${nombre} – ${new Date().toLocaleDateString()}`;
    const planId     = await this.db.crearPlanNutricional(nombrePlan, usuarioId);

    // 3) Generar cada uno de los 7 días
    const dias = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
    const plan = {
      id: planId,
      nombre: nombrePlan,
      requerimientos: reqs,
      planSemanal: {},
      resumenNutricionalSemanal: { calorias:0, proteinas:0, grasas:0, carbohidratos:0, fibra:0, micronutrientes: {} }
    };

    for (let idx = 0; idx < dias.length; idx++) {
      const dia = dias[idx];
      this.alimentosUsados.clear();
      const diario = { dia, comidas: {}, resumenNutricional: { calorias:0, proteinas:0, grasas:0, carbohidratos:0, fibra:0, micronutrientes:{} } };

      const prefs = preferencias.map(Number);
      const conds = condiciones.map(Number);

      for (const [comida, targets] of Object.entries(distrib)) {
        // ↪️ Método correcto y pasando día_idx para rotar
        const comidaGen = await this.generarComidaBalanceada(
            comida,
            targets,
            planId,
            { preferencias: prefs, condiciones: conds, diaIndice: idx }
        );
        diario.comidas[comida] = comidaGen;

        this.acumularNutrientes(diario.resumenNutricional, comidaGen.nutrientesReales);
      }

      // 4) Cumplimiento diario y acumulado semanal
      diario.cumplimiento = this.calcularCumplimiento(diario.resumenNutricional, reqs);
      plan.planSemanal[dia] = diario;
      this.acumularNutrientes(plan.resumenNutricionalSemanal, diario.resumenNutricional);
    }

    // 5) Promedios y cumplimiento general
    const count = dias.length;
    plan.promedioSemanal     = {
      calorias:      Math.round(plan.resumenNutricionalSemanal.calorias      / count),
      proteinas:     Math.round(plan.resumenNutricionalSemanal.proteinas     / count),
      grasas:        Math.round(plan.resumenNutricionalSemanal.grasas        / count),
      carbohidratos: Math.round(plan.resumenNutricionalSemanal.carbohidratos / count),
      fibra:         Math.round(plan.resumenNutricionalSemanal.fibra         / count)
    };
    plan.cumplimientoSemanal = this.calcularCumplimiento(plan.resumenNutricionalSemanal, reqs);

    return plan;
  }
  calcularRequerimientos(...args) {
    return this.calcularRequerimientosNutricionales(...args);
  }

  async obtenerPlanCompleto(planId) {
    try {
      // 1) Info general del plan y nombre de usuario
      const planInfo = await this.db.ejecutarConsulta(
          `SELECT p.*, u.nombre as usuario_nombre
         FROM plan_nutricional p
    LEFT JOIN usuario u 
           ON u.plan_nutricional_id = p.id
        WHERE p.id = ?`,
          [planId]
      );
      if (!planInfo.length) throw new Error('Plan no encontrado');

      // 2) Detalles con cada alimento y su cantidad
      const detalles = await this.db.ejecutarConsulta(
          `SELECT dp.*, a.*
         FROM detalle_plan dp
    JOIN alimentos a 
      ON dp.alimento_codigo = a.codigo
        WHERE dp.plan_nutricional_id = ?
     ORDER BY dp.id`,
          [planId]
      );

      // 3) Escalar nutrientes por porción
      const alimentos = detalles.map(detalle =>
          this.calcularNutrientesTotales(detalle, detalle.cantidad)
      );

      // 4) Generar resumen nutricional total
      return {
        plan:            planInfo[0],
        alimentos,
        resumenNutricional: this.calcularResumenNutricional(alimentos)
      };
    } catch (err) {
      console.error('Error al obtener plan completo:', err.message);
      throw err;
    }
  }

// ── 6) Calcular resumen nutricional de una lista de alimentos ────────────────
  calcularResumenNutricional(alimentos) {
    const resumen = {
      calorias:      0,
      proteinas:     0,
      grasas:        0,
      carbohidratos: 0,
      fibra:         0,
      micronutrientes: {
        calcio:0, hierro:0, zinc:0, vitamina_c:0,
        vitamina_a:0, folato:0, vitamina_b12:0,
        potasio:0, fosforo:0, sodio:0,
        grasas_saturadas:0, colesterol:0
      }
    };

    alimentos.forEach(a => {
      const n = a.nutrientes;
      resumen.calorias      += n.calorias;
      resumen.proteinas     += n.proteinas;
      resumen.grasas        += n.grasas;
      resumen.carbohidratos += n.carbohidratos;
      resumen.fibra         += n.fibra;
      for (const key in n.micronutrientes) {
        if (resumen.micronutrientes[key] != null) {
          resumen.micronutrientes[key] += n.micronutrientes[key];
        }
      }
    });

    return resumen;
  }
}
module.exports = GeneradorPlanes;
