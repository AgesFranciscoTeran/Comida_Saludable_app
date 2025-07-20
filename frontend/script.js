/* nutritionPlan.js */
const API_BASE = '/api';

/* =========================================================
   EVENTO INICIAL – cargar info de BD y registrar el formulario
   ========================================================= */
document.addEventListener('DOMContentLoaded', async () => {
  // 1) Obtener estado de la base de datos
  await cargarInfoDB();

  // 2) Interceptar envío del formulario
  document.getElementById('userForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const userData = {
      nombre:          formData.get('nombre'),
      edad:            parseInt(formData.get('edad')),
      peso:            parseFloat(formData.get('peso')),
      altura:          parseFloat(formData.get('altura')),
      sexo:            formData.get('sexo'),
      nivelActividad:  formData.get('nivelActividad'),
      objetivo:        formData.get('objetivo')
    };

    await procesarUsuario(userData);
  });
});

/* =========================================================
   SECCIÓN UI – PLAN SEMANAL Y PLAN DIARIO
   ========================================================= */

// ---------- PLAN SEMANAL ----------
function mostrarPlanSemanal(planSemanal) {
  const resultadosDiv = document.getElementById('resultados');
  const contentDiv    = document.getElementById('plan-content');

  let html = `
    <div class="plan-summary fade-in">
      <div class="row mb-4">
        <div class="col-md-4">
          <div class="card bg-primary text-white">
            <div class="card-body">
              <h5><i class="fas fa-fire"></i> Calorías Promedio Diario</h5>
              <h2>${planSemanal.promedioSemanal.calorias} kcal</h2>
              <small>Objetivo: ${planSemanal.requerimientos.calorias} kcal</small>
            </div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="card bg-success text-white">
            <div class="card-body">
              <h5><i class="fas fa-chart-pie"></i> Puntuación Semanal</h5>
              <h2>${planSemanal.cumplimientoSemanal.general}%</h2>
              <small>Cumplimiento nutricional</small>
            </div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="card bg-info text-white">
            <div class="card-body">
              <h5><i class="fas fa-calendar-week"></i> Plan Semanal</h5>
              <h2>7 días</h2>
              <small>Menú completo</small>
            </div>
          </div>
        </div>
      </div>

      <!-- Navegación por días -->
      <div class="card mb-4">
        <div class="card-header">
          <h5><i class="fas fa-calendar"></i> Seleccionar Día de la Semana</h5>
        </div>
        <div class="card-body">
          <div class="btn-group w-100" role="group">
            ${Object.keys(planSemanal.planSemanal).map((dia, idx) => `
              <button type="button"
                      class="btn btn-outline-primary dia-btn ${idx === 0 ? 'active' : ''}"
                      onclick="mostrarDia('${dia}')"
                      data-dia="${dia}">
                ${dia}
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    </div>

    <!-- Contenedor del día seleccionado -->
    <div id="dia-content"></div>
  `;

  contentDiv.innerHTML          = html;
  resultadosDiv.style.display   = 'block';

  // Guardar en global para acceso rápido
  window.currentPlanSemanal = planSemanal;

  // Mostrar primer día por defecto
  mostrarDia(Object.keys(planSemanal.planSemanal)[0]);
}

// ---------- DÍA ESPECÍFICO DE PLAN SEMANAL ----------
function mostrarDia(dia) {
  const planSemanal = window.currentPlanSemanal;
  const planDiario  = planSemanal.planSemanal[dia];

  // Actualizar botón activo
  document.querySelectorAll('.dia-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`[data-dia="${dia}"]`).classList.add('active');

  const diaContentDiv = document.getElementById('dia-content');
  let html = `
    <div class="day-plan fade-in">
      <h3 class="mb-4">
        <i class="fas fa-calendar-day"></i> ${dia}
        <span class="badge bg-primary ms-2">${planDiario.resumenNutricional.calorias} kcal</span>
        <span class="badge bg-success ms-1">${planDiario.cumplimiento.general}% cumplimiento</span>
      </h3>
      <div class="row">
  `;

  // Renderizar cada comida
  for (const [comida, detalles] of Object.entries(planDiario.comidas)) {
    html += `
      <div class="col-lg-6 mb-4">
        <div class="card meal-card">
          <div class="card-header meal-header-${comida}">
            <h5>${obtenerIconoComida(comida)} ${comida.charAt(0).toUpperCase() + comida.slice(1)}</h5>
            <div class="meal-stats">
              <span class="badge bg-light text-dark">${detalles.nutrientesReales.calorias || 0} kcal</span>
              <span class="badge bg-info">${detalles.nutrientesReales.proteinas || 0}g prot</span>
            </div>
          </div>
          <div class="card-body">
            ${detalles.alimentos.map(alimento => `
              <div class="alimento-item">
                <div class="d-flex justify-content-between align-items-center">
                  <div>
                    <strong>${alimento.nombre}</strong>
                    <small class="text-muted d-block">${alimento.cantidad}g</small>
                  </div>
                  <div class="text-end">
                    <span class="badge bg-primary">${alimento.nutrientes.calorias} kcal</span>
                    <button class="btn btn-sm btn-outline-info ms-2"
                            onclick="mostrarDetalleAlimento('${alimento.codigo}', ${alimento.cantidad})">
                      <i class="fas fa-info-circle"></i>
                    </button>
                  </div>
                </div>
                <div class="nutrient-mini-bars mt-2">
                  <div class="mini-bar">
                    <small>Proteínas: ${alimento.nutrientes.proteinas}g</small>
                    <div class="progress progress-sm">
                      <div class="progress-bar bg-success"
                           style="width:${(alimento.nutrientes.proteinas / 50) * 100}%"></div>
                    </div>
                  </div>
                  <div class="mini-bar">
                    <small>Carbohidratos: ${alimento.nutrientes.carbohidratos}g</small>
                    <div class="progress progress-sm">
                      <div class="progress-bar bg-warning"
                           style="width:${(alimento.nutrientes.carbohidratos / 100) * 100}%"></div>
                    </div>
                  </div>
                  <div class="mini-bar">
                    <small>Grasas: ${alimento.nutrientes.grasas}g</small>
                    <div class="progress progress-sm">
                      <div class="progress-bar bg-danger"
                           style="width:${(alimento.nutrientes.grasas / 30) * 100}%"></div>
                    </div>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  diaContentDiv.innerHTML = html + '</div></div>';
}

// ---------- PLAN DIARIO COMPLETO ----------
function mostrarPlan(plan) {
  const resultadosDiv = document.getElementById('resultados');
  const contentDiv    = document.getElementById('plan-content');

  let html = `
    <div class="plan-summary fade-in">
      <div class="row mb-4">
        <div class="col-md-6">
          <div class="card bg-primary text-white">
            <div class="card-body">
              <h5><i class="fas fa-fire"></i> Calorías Diarias</h5>
              <h2>${plan.requerimientos.calorias} kcal</h2>
              <small>Real: ${plan.resumenNutricional.calorias} kcal</small>
            </div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="card bg-success text-white">
            <div class="card-body">
              <h5><i class="fas fa-chart-pie"></i> Puntuación General</h5>
              <h2>${plan.cumplimiento.general}%</h2>
              <small>Cumplimiento nutricional</small>
            </div>
          </div>
        </div>
      </div>

      <!-- Macronutrientes -->
      <div class="card mb-4">
        <div class="card-header">
          <h5><i class="fas fa-chart-bar"></i> Distribución de Macronutrientes</h5>
        </div>
        <div class="card-body">
          <div class="row">
            <div class="col-md-4">
              <div class="text-center">
                <div class="progress-circle"
                     data-percent="${plan.cumplimiento.macronutrientes.proteinas.porcentaje}">
                  <span class="progress-text">
                    <strong>${plan.resumenNutricional.proteinas}g</strong><br>
                    <small>Proteínas</small>
                  </span>
                </div>
                <p class="mt-2 small">Objetivo: ${plan.requerimientos.macronutrientes.proteinas}g</p>
              </div>
            </div>
            <div class="col-md-4">
              <div class="text-center">
                <div class="progress-circle"
                     data-percent="${plan.cumplimiento.macronutrientes.carbohidratos.porcentaje}">
                  <span class="progress-text">
                    <strong>${plan.resumenNutricional.carbohidratos}g</strong><br>
                    <small>Carbohidratos</small>
                  </span>
                </div>
                <p class="mt-2 small">Objetivo: ${plan.requerimientos.macronutrientes.carbohidratos}g</p>
              </div>
            </div>
            <div class="col-md-4">
              <div class="text-center">
                <div class="progress-circle"
                     data-percent="${plan.cumplimiento.macronutrientes.grasas.porcentaje}">
                  <span class="progress-text">
                    <strong>${plan.resumenNutricional.grasas}g</strong><br>
                    <small>Grasas</small>
                  </span>
                </div>
                <p class="mt-2 small">Objetivo: ${plan.requerimientos.macronutrientes.grasas}g</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Micronutrientes -->
      <div class="card mb-4">
        <div class="card-header">
          <h5><i class="fas fa-pills"></i> Micronutrientes Clave</h5>
        </div>
        <div class="card-body">
          <div class="row">
            ${generarMicronutrientes(plan.cumplimiento.micronutrientes,
                                     plan.resumenNutricional.micronutrientes)}
          </div>
        </div>
      </div>
    </div>

    <div class="row">
  `;

  /* ---------- COMIDAS ---------- */
  for (const [comida, detalles] of Object.entries(plan.comidas)) {
    html += `
      <div class="col-lg-6 mb-4">
        <div class="card meal-card">
          <div class="card-header meal-header-${comida}">
            <h5>${obtenerIconoComida(comida)} ${comida.charAt(0).toUpperCase() + comida.slice(1)}</h5>
            <div class="meal-stats">
              <span class="badge bg-light text-dark">
                ${detalles.nutrientesReales.calorias || 0} kcal
              </span>
              <span class="badge bg-info">
                ${detalles.nutrientesReales.proteinas || 0}g prot
              </span>
            </div>
          </div>
          <div class="card-body">
            ${detalles.alimentos.map(alimento => `
              <div class="alimento-item">
                <div class="d-flex justify-content-between align-items-center">
                  <div>
                    <strong>${alimento.nombre}</strong>
                    <small class="text-muted d-block">${alimento.cantidad}g</small>
                  </div>
                  <div class="text-end">
                    <span class="badge bg-primary">${alimento.nutrientes.calorias} kcal</span>
                    <button class="btn btn-sm btn-outline-info ms-2"
                            onclick="mostrarDetalleAlimento('${alimento.codigo}', ${alimento.cantidad})">
                      <i class="fas fa-info-circle"></i>
                    </button>
                  </div>
                </div>
                <div class="nutrient-mini-bars mt-2">
                  <div class="mini-bar">
                    <small>Proteínas: ${alimento.nutrientes.proteinas}g</small>
                    <div class="progress progress-sm">
                      <div class="progress-bar bg-success"
                           style="width:${(alimento.nutrientes.proteinas / detalles.targets.proteinas) * 100}%"></div>
                    </div>
                  </div>
                  <div class="mini-bar">
                    <small>Carbohidratos: ${alimento.nutrientes.carbohidratos}g</small>
                    <div class="progress progress-sm">
                      <div class="progress-bar bg-warning"
                           style="width:${(alimento.nutrientes.carbohidratos / detalles.targets.carbohidratos) * 100}%"></div>
                    </div>
                  </div>
                  <div class="mini-bar">
                    <small>Grasas: ${alimento.nutrientes.grasas}g</small>
                    <div class="progress progress-sm">
                      <div class="progress-bar bg-danger"
                           style="width:${(alimento.nutrientes.grasas / detalles.targets.grasas) * 100}%"></div>
                    </div>
                  </div>
                </div>
              </div>
            `).join('')}

            <!-- Análisis -->
            <div class="meal-analysis mt-3">
              <h6>Análisis Nutricional:</h6>
              <div class="row">
                <div class="col-6">
                  <small class="text-success">Logrado:</small>
                  <ul class="small mb-0">
                    ${Object.entries(detalles.analisis)
                             .filter(([_, v]) => v.cumple)
                             .map(([k, v]) => `<li>${k}: ${v.porcentaje}%</li>`)
                             .join('')}
                  </ul>
                </div>
                <div class="col-6">
                  <small class="text-warning">A mejorar:</small>
                  <ul class="small mb-0">
                    ${Object.entries(detalles.analisis)
                             .filter(([_, v]) => !v.cumple)
                             .map(([k, v]) => `<li>${k}: ${v.porcentaje}%</li>`)
                             .join('')}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /* ---------- BOTONES ----------- */
  html += `
    </div>
    <div class="text-center mt-4">
      <button class="btn btn-success btn-lg me-3" onclick="regenerarPlan()">
        <i class="fas fa-refresh"></i> Generar Nuevo Plan
      </button>
      <button class="btn btn-info btn-lg me-3" onclick="descargarPlan()">
        <i class="fas fa-download"></i> Descargar PDF
      </button>
      <button class="btn btn-outline-primary btn-lg" onclick="compartirPlan()">
        <i class="fas fa-share"></i> Compartir
      </button>
    </div>
  `;

  contentDiv.innerHTML        = html;
  resultadosDiv.style.display = 'block';
  initProgressCircles();
  resultadosDiv.scrollIntoView({ behavior: 'smooth' });
}

/* =========================================================
   SECCIÓN PETICIONES / LÓGICA DE NEGOCIO
   ========================================================= */

async function cargarInfoDB() {
  try {
    const res  = await fetch(`${API_BASE}/info`);
    const data = await res.json();
    document.getElementById('db-info').innerHTML =
      `<i class="fas fa-database"></i> Base de datos conectada – ${data.totalAlimentos} alimentos disponibles`;
  } catch (err) {
    const dbInfo = document.getElementById('db-info');
    dbInfo.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error al conectar con la base de datos';
    dbInfo.className = 'alert alert-warning';
  }
}

async function procesarUsuario(userData) {
  mostrarLoading(true);
  limpiarAlertas();

  try {
    await crearUsuario(userData);

    const planRes = await fetch(`${API_BASE}/generar-plan`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ nombre: userData.nombre })
    });

    if (!planRes.ok) throw new Error('Error al generar plan nutricional');
    const planData = await planRes.json();

    if (planData.plan.planSemanal) {
      mostrarPlanSemanal(planData.plan);
    } else {
      mostrarPlan(planData.plan);
    }
  } catch (err) {
    mostrarAlerta('error', `Error: ${err.message}`);
  } finally {
    mostrarLoading(false);
  }
}

async function crearUsuario(userData) {
  const res = await fetch(`${API_BASE}/usuarios`, {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify(userData)
  });

  if (!res.ok) {
    const errData = await res.json();
    if (res.status === 400 && errData.error.includes('ya existe')) return; // OK si ya existe
    throw new Error(errData.error);
  }
}

async function generarNuevoPlan() {
  const email = document.getElementById('email').value;
  if (!email) return mostrarAlerta('warning', 'Por favor ingresa tu email');

  mostrarLoading(true);
  try {
    const res = await fetch(`${API_BASE}/generar-plan`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ email })
    });
    if (!res.ok) throw new Error('Error al generar nuevo plan');

    const data = await res.json();
    mostrarPlan(data.plan);
    mostrarAlerta('success', '¡Nuevo plan generado exitosamente!');
  } catch (err) {
    mostrarAlerta('error', `Error: ${err.message}`);
  } finally {
    mostrarLoading(false);
  }
}

/* =========================================================
   SECCIÓN UTILIDADES UI
   ========================================================= */

function mostrarLoading(show) {
  document.getElementById('loading').style.display = show ? 'block' : 'none';
}

function mostrarAlerta(tipo, mensaje) {
  const alertsDiv = document.getElementById('alerts');
  const cls = {
    success: 'alert-success',
    error  : 'alert-danger',
    warning: 'alert-warning',
    info   : 'alert-info'
  }[tipo] || 'alert-info';

  alertsDiv.innerHTML = `
    <div class="alert ${cls} alert-dismissible fade show" role="alert">
      ${mensaje}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>
  `;
  setTimeout(() => alertsDiv.firstElementChild?.remove(), 5000);
}

function limpiarAlertas() {
  document.getElementById('alerts').innerHTML = '';
}

function generarMicronutrientes(cumplimiento, valores) {
  const listado = [
    { key: 'calcio',      nom: 'Calcio',      un: 'mg', icon: 'fas fa-bone' },
    { key: 'hierro',      nom: 'Hierro',      un: 'mg', icon: 'fas fa-tint' },
    { key: 'zinc',        nom: 'Zinc',        un: 'mg', icon: 'fas fa-shield-alt' },
    { key: 'vitamina_c',  nom: 'Vit. C',      un: 'mg', icon: 'fas fa-lemon' },
    { key: 'vitamina_a',  nom: 'Vit. A',      un: 'µg', icon: 'fas fa-eye' },
    { key: 'folato',      nom: 'Folato',      un: 'µg', icon: 'fas fa-dna' },
    { key: 'fibra',       nom: 'Fibra',       un: 'g',  icon: 'fas fa-leaf' },
    { key: 'potasio',     nom: 'Potasio',     un: 'mg', icon: 'fas fa-heartbeat' }
  ];

  return listado.map(n => {
    const dato       = cumplimiento[n.key] || {};
    const valor      = valores[n.key] || 0;
    const pct        = dato.porcentaje || 0;
    const colorClass = pct >= 80 ? 'success' : pct >= 60 ? 'warning' : 'danger';

    return `
      <div class="col-md-3 col-sm-6 mb-3">
        <div class="micronutrient-card">
          <div class="d-flex align-items-center">
            <i class="${n.icon} text-${colorClass} me-2"></i>
            <div>
              <strong>${Math.round(valor * 100) / 100}${n.un}</strong>
              <small class="d-block text-muted">${n.nom}</small>
            </div>
          </div>
          <div class="progress mt-1" style="height:4px;">
            <div class="progress-bar bg-${colorClass}" style="width:${Math.min(pct, 100)}%"></div>
          </div>
          <small class="text-muted">${pct}% del objetivo</small>
        </div>
      </div>
    `;
  }).join('');
}

function obtenerIconoComida(comida) {
  const map = { desayuno:'☕', almuerzo:'🍽️', cena:'🌙', snacks:'🍪' };
  return map[comida] || '🍽️';
}

/* -------- detalle alimento -------- */
async function mostrarDetalleAlimento(codigo, cantidad) {
  try {
    const res  = await fetch(`${API_BASE}/alimentos/${codigo}/analisis?cantidad=${cantidad}`);
    const data = await res.json();
    mostrarModalAlimento(data.alimento, data.recomendaciones);
  } catch (err) {
    mostrarAlerta('error', 'Error al cargar información del alimento');
  }
}

function mostrarModalAlimento(alimento, recomendaciones) {
  const modalHtml = `
    <div class="modal fade" id="alimentoModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">${alimento.nombre} - ${alimento.cantidad}g</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="row">
              <div class="col-md-6">
                <h6><i class="fas fa-fire text-danger"></i> Información Nutricional</h6>
                <div class="card mb-3">
                  <div class="card-body">
                    <div class="row text-center">
                      <div class="col-4">
                        <strong class="text-primary">${alimento.nutrientes.calorias}</strong>
                        <small class="d-block text-muted">kcal</small>
                      </div>
                      <div class="col-4">
                        <strong class="text-success">${alimento.nutrientes.proteinas}g</strong>
                        <small class="d-block text-muted">Proteínas</small>
                      </div>
                      <div class="col-4">
                        <strong class="text-warning">${alimento.nutrientes.carbohidratos}g</strong>
                        <small class="d-block text-muted">Carbohidratos</small>
                      </div>
                    </div>
                    <div class="row text-center mt-2">
                      <div class="col-4">
                        <strong class="text-danger">${alimento.nutrientes.grasas}g</strong>
                        <small class="d-block text-muted">Grasas</small>
                      </div>
                      <div class="col-4">
                        <strong class="text-info">${alimento.nutrientes.fibra}g</strong>
                        <small class="d-block text-muted">Fibra</small>
                      </div>
                      <div class="col-4">
                        <strong class="text-secondary">${alimento.nutrientes.sodio}mg</strong>
                        <small class="d-block text-muted">Sodio</small>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="col-md-6">
                <h6><i class="fas fa-gem text-warning"></i> Minerales y Vitaminas</h6>
                <div class="card mb-3">
                  <div class="card-body">
                    <div class="row text-center">
                      <div class="col-6">
                        <strong class="text-info">${alimento.nutrientes.calcio}mg</strong>
                        <small class="d-block text-muted">Calcio</small>
                      </div>
                      <div class="col-6">
                        <strong class="text-danger">${alimento.nutrientes.hierro}mg</strong>
                        <small class="d-block text-muted">Hierro</small>
                      </div>
                    </div>
                    <div class="row text-center mt-2">
                      <div class="col-6">
                        <strong class="text-primary">${alimento.nutrientes.zinc}mg</strong>
                        <small class="d-block text-muted">Zinc</small>
                      </div>
                      <div class="col-6">
                        <strong class="text-success">${alimento.nutrientes.vitamina_c}mg</strong>
                        <small class="d-block text-muted">Vitamina C</small>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            ${recomendaciones ? `
            <div class="mt-3">
              <h6><i class="fas fa-lightbulb text-warning"></i> Evaluación Nutricional</h6>
              <div class="alert alert-${recomendaciones.categoria === 'Excelente' ? 'success' : recomendaciones.categoria === 'Bueno' ? 'info' : recomendaciones.categoria === 'Regular' ? 'warning' : recomendaciones.categoria === 'Procesado' ? 'danger' : 'secondary'}">
                <strong>${recomendaciones.categoria}</strong> - Puntuación: ${recomendaciones.puntuacion}/100
                ${recomendaciones.descripcion ? `<br><small>${recomendaciones.descripcion}</small>` : ''}
              </div>
              
              ${recomendaciones.fortalezas && recomendaciones.fortalezas.length > 0 ? `
              <div class="card mb-2">
                <div class="card-body">
                  <h6 class="text-success"><i class="fas fa-check-circle"></i> Fortalezas:</h6>
                  <ul class="mb-0">
                    ${recomendaciones.fortalezas.map(f => `<li>${f}</li>`).join('')}
                  </ul>
                </div>
              </div>
              ` : ''}
              
              ${recomendaciones.recomendaciones && recomendaciones.recomendaciones.length > 0 ? `
              <div class="card mb-2">
                <div class="card-body">
                  <h6 class="text-info"><i class="fas fa-info-circle"></i> Recomendaciones:</h6>
                  <ul class="mb-0">
                    ${recomendaciones.recomendaciones.map(r => `<li>${r}</li>`).join('')}
                  </ul>
                </div>
              </div>
              ` : ''}
              
              ${recomendaciones.debilidades && recomendaciones.debilidades.length > 0 ? `
              <div class="card">
                <div class="card-body">
                  <h6 class="text-warning"><i class="fas fa-exclamation-triangle"></i> Consideraciones:</h6>
                  <ul class="mb-0">
                    ${recomendaciones.debilidades.map(d => `<li>${d}</li>`).join('')}
                  </ul>
                </div>
              </div>
              ` : ''}
            </div>
            ` : ''}
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('alimentoModal')?.remove(); // quitar anterior
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  new bootstrap.Modal(document.getElementById('alimentoModal')).show();
}

/* -------- círculos de progreso -------- */
function initProgressCircles() {
  document.querySelectorAll('.progress-circle').forEach(el => {
    const pct = Math.min(parseInt(el.dataset.percent) || 0, 100);
    const color = pct >= 80 ? '#28a745' : pct >= 60 ? '#ffc107' : '#dc3545';
    el.style.background = `conic-gradient(${color} ${pct * 3.6}deg, #e9ecef ${pct * 3.6}deg)`;
    Object.assign(el.style, {
      borderRadius: '50%',
      position    : 'relative',
      width       : '100px',
      height      : '100px',
      display     : 'flex',
      alignItems  : 'center',
      justifyContent: 'center'
    });
  });
}

/* -------- acciones “placeholder” -------- */
function descargarPlan() {
  mostrarAlerta('info', 'Función de descarga en desarrollo. Próximamente podrás descargar tu plan en PDF.');
}

function compartirPlan() {
  if (navigator.share) {
    navigator.share({
      title: 'Mi Plan Nutricional',
      text : 'Revisa mi plan nutricional personalizado',
      url  : window.location.href
    }).catch(() => {});
  } else {
    navigator.clipboard.writeText(window.location.href)
      .then(() => mostrarAlerta('success', 'Enlace copiado al portapapeles'))
      .catch(() => mostrarAlerta('info', 'Copia este enlace: ' + window.location.href));
  }
}

/* -------- regenerar (alias a generarNuevoPlan para compat.) -------- */
function regenerarPlan() {
  generarNuevoPlan();
}
