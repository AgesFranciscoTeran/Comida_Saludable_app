/* nutritionPlan.js */
const API_BASE = '/api';

/* =========================================================
   EVENTO INICIAL – cargar info de BD y registrar el formulario
   ========================================================= */
document.getElementById('form').addEventListener('submit', async e => {
    console.log('🚀 submit handler arrancó');
    e.preventDefault();
    limpiarAlertas();
    mostrarLoading(true);

    const form  = e.target;
    const datos = Object.fromEntries(new FormData(form).entries());
    datos.preferencias = [...form.querySelectorAll('input[name="preferencias"]:checked')].map(cb => cb.value);
    datos.condiciones  = [...form.querySelectorAll('input[name="condiciones"]:checked')].map(cb => cb.value);

    console.log('📋 datos a enviar:', datos);

    try {
        console.log('🔗 POST /api/usuarios …');
        const res = await fetch(`${API_BASE}/usuarios`, {
            method : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body   : JSON.stringify(datos)
        });

        const resJson = await res.json();
        if (!res.ok) throw new Error(resJson.error || 'Error al crear usuario');

        const plan = resJson.plan;
        if (!plan) throw new Error('No se recibió un plan');

        currentPlanId = plan.id;
        console.log('📦 plan recibido:', plan);
        console.log('🧾 Días generados:', Object.keys(plan.planSemanal || {}));
        console.log('📊 Promedio semanal:', plan.promedioSemanal);
        console.log('🍽️ Día Lunes:', plan.planSemanal?.Lunes);

        if (plan.planSemanal) {
            mostrarPlanSemanal(plan);
        } else {
            mostrarPlan(plan);
        }

        form.reset();
    } catch (err) {
        console.error('❌ Error en submit handler:', err);
        mostrarAlerta('error', `Error: ${err.message}`);
    } finally {
        mostrarLoading(false);
        console.log('✅ submit handler finalizado');
    }
});

/* =========================================================
   SECCIÓN UI – PLAN SEMANAL Y PLAN DIARIO
   ========================================================= */

// Muestra el resumen semanal + pestañas de días
/* =======================================================================
   Funciones de UI corregidas para mostrar plan semanal y diario
   ======================================================================= */

/**
 * Muestra el plan semanal completo:
 * - Resumen semanal
 * - Pestañas para cada día
 * - Detalle del primer día por defecto
 */
function mostrarPlanSemanal(plan) {
    console.log('🔍 plan recibido en mostrarPlanSemanal:', plan);

    const dias = Object.keys(plan.planSemanal || {});
    if (!dias.length) {
        console.warn('⚠️ El planSemanal está vacío');
        return;
    }
    if (!plan?.planSemanal || Object.keys(plan.planSemanal).length === 0) {
        mostrarAlerta('warning','Plan semanal no disponible');
        return;
    }

    const resultadosDiv = document.getElementById('resultados');
    const contentDiv    = document.getElementById('plan-content');
    resultadosDiv.style.display = 'block';

    // --- 1) Resumen superior: calorías & días (sin puntuación semanal) ---
    const avgCal    = plan.promedioSemanal?.calorias    ?? 0;
    const reqCal    = plan.requerimientos?.calorias      ?? 0;
    const totalDias = Object.keys(plan.planSemanal).length;

    let html = `
    <div class="plan-summary mb-4 fade-in">
      <div class="row text-center g-3">
        <div class="col-md-6">
          <div class="card bg-primary text-white">
            <div class="card-body">
              <h5><i class="fas fa-fire"></i> Calorías Promedio Diario</h5>
              <h2>${avgCal} kcal</h2>
              <small>Objetivo: ${reqCal} kcal</small>
            </div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="card bg-info text-white">
            <div class="card-body">
              <h5><i class="fas fa-calendar-week"></i> Días</h5>
              <h2>${totalDias} días</h2>
              <small>Completos</small>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tabs de días -->
    <ul class="nav nav-tabs mb-3" id="dias-tab"></ul>
    <div id="dia-content"></div>
  `;

    contentDiv.innerHTML = html;

    // 2) Crear pestañas
    const diasTab = document.getElementById('dias-tab');
    Object.keys(plan.planSemanal).forEach((dia,i) => {
        const li = document.createElement('li');
        li.className = 'nav-item';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `nav-link ${i===0?'active':''}`;
        btn.textContent = dia;
        btn.onclick = () => {
            diasTab.querySelectorAll('.nav-link').forEach(x=>x.classList.remove('active'));
            btn.classList.add('active');
            mostrarDia(plan.planSemanal[dia], dia);
        };
        li.appendChild(btn);
        diasTab.appendChild(li);
    });

    // 3) Mostrar primer día
    mostrarDia(plan.planSemanal[ Object.keys(plan.planSemanal)[0] ],
        Object.keys(plan.planSemanal)[0]);
}

/**
 * Muestra el detalle de un día concreto (desayuno, almuerzo, snacks, cena)
 */
function mostrarDia(detalles={}, diaNombre='') {
    const diaContent = document.getElementById('dia-content');
    const resumen    = detalles.resumenNutricional || {};
    const cumple     = detalles.cumplimiento     || {};
    const comidas    = detalles.comidas          || {};

    let html = `
    <div class="day-plan fade-in">
      <h4>
        <i class="fas fa-calendar-day"></i> ${diaNombre}
        <span class="badge bg-primary ms-2">${resumen.calorias ?? 0} kcal</span>
      </h4>
      <div class="row gy-4">
  `;

    ['desayuno','almuerzo','snacks','cena'].forEach(tipo => {
        const det = comidas[tipo] || {};
        const nut = det.nutrientesReales || {};
        const als = Array.isArray(det.alimentos) ? det.alimentos : [];

        html += `
      <div class="col-lg-6">
        <div class="card meal-card">
          <div class="card-header meal-header-${tipo}">
            <h5>${obtenerIconoComida(tipo)} ${tipo.charAt(0).toUpperCase()+tipo.slice(1)}</h5>
            <div class="meal-stats">
              <span class="badge bg-light text-dark">${nut.calorias   ?? 0} kcal</span>
              <span class="badge bg-info">${nut.proteinas  ?? 0}g prot</span>
            </div>
          </div>
          <div class="card-body">
            ${als.map(al => `
              <div class="alimento-item mb-2">
                <div class="d-flex justify-content-between">
                  <div>
                    <strong>${al.nombre}</strong>
                    <small class="text-muted d-block">${al.cantidad}g</small>
                  </div>
                  <div>
                    <span class="badge bg-primary">${al.nutrientes.calorias ?? 0} kcal</span>
                    <button class="btn btn-sm btn-outline-info ms-2"
                            onclick="mostrarDetalleAlimento(${al.codigo}, ${al.cantidad})">
                      <i class="fas fa-info-circle"></i>
                    </button>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
    });

    html += `</div></div>`;
    diaContent.innerHTML = html;
}

/**
 * Fallback para mostrar un plan diario individual
 */
function mostrarPlan(plan) {
    if (!plan) {
        mostrarAlerta('warning','Plan diario no disponible');
        return;
    }
    if (plan.planSemanal) {
        mostrarPlanSemanal(plan);
    } else {
        // Reutilizamos la vista de un solo día:
        mostrarDia(plan, 'Hoy');
    }
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
    console.log('📝 procesarUsuario', userData);
    mostrarLoading(true);
    try {
        const resUser = await fetch(`${API_BASE}/usuarios`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify(userData)
        });
        console.log('📤 /api/usuarios status', resUser.status);
        const result = await resUser.json();
        const plan = result.plan;
        if (!plan || !plan.id) throw new Error('Plan no recibido');
        currentPlanId = plan.id;
        console.log('🔖 Plan ID guardado:', currentPlanId);
        mostrarPlan(plan);
    } catch(err) {
        console.error('❌ procesarUsuario error:', err);
        mostrarAlerta('error', err.message);
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
    console.log(`ℹ️ solicitar análisis ${codigo} x${cantidad}g`);
    mostrarLoading(true);
    try {
        const res = await fetch(`${API_BASE}/alimentos/${codigo}/analisis?cantidad=${cantidad}`);
        console.log('📤 análisis status', res.status);
        const data = await res.json();
        console.log('🔍 análisis datos', data);
        mostrarModalAlimento(data.alimento, data.recomendaciones);
    } catch(err) {
        console.error('❌ mostrarDetalleAlimento error:', err);
        mostrarAlerta('error', 'Error al cargar información del alimento');
    } finally {
        mostrarLoading(false);
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
              ${recomendaciones.categoria && recomendaciones.puntuacion !== undefined ? `
  <h6><i class="fas fa-lightbulb text-warning"></i> Evaluación Nutricional</h6>
  <div class="alert alert-${recomendaciones.categoria === 'Excelente' ? 'success' :
      recomendaciones.categoria === 'Bueno' ? 'info' :
          recomendaciones.categoria === 'Regular' ? 'warning' :
              recomendaciones.categoria === 'Procesado' ? 'danger' :
                  'secondary'}">
    <strong>${recomendaciones.categoria}</strong> - Puntuación: ${recomendaciones.puntuacion}/100
    ${recomendaciones.descripcion ? `<br><small>${recomendaciones.descripcion}</small>` : ''}
  </div>
` : ''}
              
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
async function cargarPreferencias() {
    const res = await fetch('/api/preferencias');
    const preferencias = await res.json();
    const contenedor = document.getElementById('preferencias-lista');
    contenedor.innerHTML = '';
    preferencias.forEach(pref => {
        contenedor.innerHTML += `
      <label><input type="checkbox" name="preferencias" value="${pref.id}"> ${pref.nombre}</label><br>
    `;
    });
}

async function cargarCondiciones() {
    const res = await fetch('/api/condiciones');
    const condiciones = await res.json();
    const contenedor = document.getElementById('condiciones-lista');
    contenedor.innerHTML = '';
    condiciones.forEach(cond => {
        contenedor.innerHTML += `
      <label><input type="checkbox" name="condiciones" value="${cond.id}"> ${cond.nombre}</label><br>
    `;
    });
}

document.addEventListener('DOMContentLoaded', () => {
    cargarPreferencias();
    cargarCondiciones();
});

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
async function descargarPlan() {
    console.log('⬇️ descargarPlan invoked');
    mostrarLoading(true);
    try {
        if (!currentPlanId) throw new Error('Plan ID no definido');
        const res = await fetch(`${API_BASE}/descargar-plan/${currentPlanId}`);
        console.log('📤 descargar-plan status', res.status);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href=url;
        a.download = `plan_${currentPlanId}.json`;
        document.body.appendChild(a);
        a.click(); a.remove();
        URL.revokeObjectURL(url);
        console.log('✅ descarga iniciada');
    } catch(err) {
        console.error('❌ descargarPlan error:', err);
        mostrarAlerta('error', `Error descarga: ${err.message}`);
    } finally { mostrarLoading(false); }
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
document.addEventListener('DOMContentLoaded', () => {
    const cards = document.querySelectorAll('.card.bg-success.text-white');
    cards.forEach(c=>c.remove());
});
/* -------- regenerar (alias a generarNuevoPlan para compat.) -------- */
function regenerarPlan() {
  generarNuevoPlan();
}
