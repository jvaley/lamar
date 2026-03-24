'use strict';

const API = 'http://localhost:3000';
let globalData = null;
let sessionPwd = '';

lucide.createIcons();

/* ── Helpers ── */
function dateToJSON(dateStr) {
    if (!dateStr) return '';
    const months = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
    const [y, m, d] = dateStr.split('-');
    return `${d} ${months[parseInt(m)-1]} ${y}`;
}

function dateToInput(jsonDate) {
    if (!jsonDate) return '';
    const months = {'ENE':'01','FEB':'02','MAR':'03','ABR':'04','MAY':'05','JUN':'06','JUL':'07','AGO':'08','SEP':'09','OCT':'10','NOV':'11','DIC':'12'};
    const parts = jsonDate.split(' ');
    if (parts.length !== 3) return '';
    const d = parts[0].padStart(2, '0');
    const m = months[parts[1].toUpperCase()] || '01';
    const y = parts[2];
    return `${y}-${m}-${d}`;
}

async function handleFileUpload(input, targetId) {
    const file = input.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    try {
        const res = await fetch(`${API}/api/upload`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (res.ok) {
            document.getElementById(targetId).value = data.path;
            showToast('Imagen subida correctamente.', 'success');
        } else {
            showToast(data.error || 'Error al subir imagen', 'error');
        }
    } catch (e) {
        showToast('Error de conexión al subir imagen', 'error');
    }
}

function searchMapEmbed(fieldId) {
    const val = document.getElementById(fieldId).value.trim();
    if (!val) { showToast('Ingresa un nombre o destino primero.', 'info'); return; }
    const url = `https://www.google.com/maps/search/${encodeURIComponent(val)}`;
    window.open(url, '_blank');
    showToast('Buscando en Google Maps. Haz clic en "Compartir" > "Incorporar un mapa" para obtener el código.', 'info');
}

function exportToExcel(type) {
    if (!globalData) return;
    let data = [];
    let filename = '';

    if (type === 'paquetes') {
        filename = 'Paquetes_Viajes_La_Mar.xlsx';
        data = globalData.packagesData.es.map(p => ({
            'ID': p.id,
            'Nombre': p.nombre,
            'Tagline': p.tagline,
            'Precio': p.precio,
            'Descripción': p.descripcion,
            'Más Info': p.mas_info,
            'Incluye': (p.incluye || []).join(', '),
            'Días Itinerario': (p.itinerario || []).length
        }));
    } else {
        filename = 'Salidas_Viajes_La_Mar.xlsx';
        data = globalData.scheduledTrips.map(t => ({
            'ID': t.id,
            'Categoría': t.categoria,
            'Destino': t.destino.es,
            'Fecha': t.fecha.es,
            'Noches': t.noches,
            'Tipo': t.tipo.es,
            'Precio': t.precio.es,
            'Estado': t.estado,
            'Cupos': t.cuposLibres,
            'Tag': t.tag.es,
            'Descripción': t.descripcion.es,
            'Más Info': t.mas_info.es
        }));
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, type.charAt(0).toUpperCase() + type.slice(1));

    // Ajustar anchos de columna básicos
    const wscols = Object.keys(data[0] || {}).map(() => ({ wch: 20 }));
    worksheet['!cols'] = wscols;

    XLSX.writeFile(workbook, filename);
    showToast(`Excel de ${type} exportado.`, 'success');
}

/* ── Auth ── */
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pwd = document.getElementById('admin-pwd').value.trim();
    const btn = document.getElementById('login-btn');
    const err = document.getElementById('login-error');
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Verificando...';
    lucide.createIcons();
    err.classList.add('hidden');
    try {
        const res = await fetch(`${API}/api/auth`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pwd })
        });
        if (!res.ok) {
            const d = await res.json();
            err.innerText = d.error || 'Contraseña incorrecta.';
            err.classList.remove('hidden');
        } else {
            sessionPwd = pwd;
            await loadData();
        }
    } catch {
        err.innerText = 'No se puede conectar al servidor. ¿Está corriendo npm start?';
        err.classList.remove('hidden');
    }
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="log-in" class="w-4 h-4"></i> INGRESAR';
    lucide.createIcons();
});

function togglePwd() {
    const input = document.getElementById('admin-pwd');
    const icon  = document.getElementById('eye-icon');
    input.type = input.type === 'password' ? 'text' : 'password';
    icon.setAttribute('data-lucide', input.type === 'password' ? 'eye' : 'eye-off');
    lucide.createIcons();
}

function logout() {
    sessionPwd = ''; globalData = null;
    document.getElementById('admin-pwd').value = '';
    document.getElementById('dashboard-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    switchTab('paquetes');
}

/* ── Data ── */
async function loadData() {
    const res = await fetch(`${API}/api/data`);
    if (!res.ok) throw new Error('No se pudo leer data.json');
    globalData = await res.json();
    renderPaquetes(); renderImagenes(); renderSalidas();
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard-screen').classList.remove('hidden');
    lucide.createIcons();
    showToast('Sesión iniciada correctamente.', 'success');
}

async function saveAll() {
    const btn = document.getElementById('save-btn');
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Guardando...';
    lucide.createIcons();
    try {
        const res = await fetch(`${API}/api/data`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: sessionPwd, data: globalData })
        });
        const result = await res.json();
        if (res.ok) showToast('✅ Datos guardados. La web ya está actualizada.', 'success');
        else { showToast('❌ ' + (result.error || 'Error al guardar.'), 'error'); if (res.status === 401) setTimeout(logout, 2000); }
    } catch { showToast('❌ Sin conexión al servidor.', 'error'); }
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="save" class="w-4 h-4"></i> GUARDAR TODO';
    lucide.createIcons();
}

/* ── Tabs ── */
function switchTab(tab) {
    ['paquetes','imagenes','salidas'].forEach(t => {
        document.getElementById(`tab-${t}`).classList.add('hidden');
        document.getElementById(`nav-${t}`).classList.remove('border-sky-500','text-sky-500');
        document.getElementById(`nav-${t}`).classList.add('border-transparent','text-slate-400');
    });
    document.getElementById(`tab-${tab}`).classList.remove('hidden');
    document.getElementById(`nav-${tab}`).classList.add('border-sky-500','text-sky-500');
    document.getElementById(`nav-${tab}`).classList.remove('border-transparent','text-slate-400');
}

/* ── Toast ── */
function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    const inner = document.getElementById('toast-inner');
    const text  = document.getElementById('toast-msg');
    const icon  = document.getElementById('toast-icon');
    text.innerText = msg;
    inner.className = 'flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl text-sm font-bold text-white min-w-[260px]';
    if (type === 'success') { inner.classList.add('bg-emerald-600'); icon.setAttribute('data-lucide','check-circle'); }
    else if (type === 'error') { inner.classList.add('bg-red-600'); icon.setAttribute('data-lucide','alert-circle'); }
    else { inner.classList.add('bg-slate-700'); icon.setAttribute('data-lucide','info'); }
    lucide.createIcons();
    toast.classList.remove('translate-y-24','opacity-0');
    toast.classList.add('translate-y-0','opacity-100');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
        toast.classList.add('translate-y-24','opacity-0');
        toast.classList.remove('translate-y-0','opacity-100');
    }, 4000);
}

/* ── Modals ── */
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); lucide.createIcons(); }
document.querySelectorAll('.modal-bg').forEach(bg => bg.addEventListener('click', e => { if (e.target === bg) bg.classList.add('hidden'); }));

/* ══════════════ PAQUETES ══════════════ */
function renderPaquetes() {
    const list = document.getElementById('paquetes-list');
    if (!globalData?.packagesData?.es?.length) { list.innerHTML = '<p class="text-slate-400 text-sm">No hay paquetes.</p>'; return; }
    list.innerHTML = '';
    globalData.packagesData.es.forEach((pkg, i) => {
        const card = document.createElement('div');
        card.className = 'card flex flex-col md:flex-row md:items-center gap-4';
        card.innerHTML = `
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                    <span class="text-xs font-black text-sky-500 uppercase tracking-widest">${pkg.id}</span>
                    <span class="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">${pkg.precio}</span>
                </div>
                <p class="font-bold text-slate-800 truncate">${pkg.nombre}</p>
                <p class="text-xs text-slate-400 truncate">${pkg.tagline}</p>
            </div>
            <div class="flex gap-2">
                <button onclick="openPaqueteModal(${i})" class="btn-ghost"><i data-lucide="pencil" class="w-4 h-4"></i> Editar</button>
                <button onclick="deletePaquete(${i})" class="btn-danger"><i data-lucide="trash-2" class="w-4 h-4"></i> Eliminar</button>
            </div>`;
        list.appendChild(card);
    });
    lucide.createIcons();
}

function openPaqueteModal(idx) {
    const isNew = idx === null;
    document.getElementById('pkg-modal-title').innerText = isNew ? 'Nuevo Paquete' : 'Editar Paquete';
    document.getElementById('pkg-idx').value = isNew ? '' : idx;
    const pkg = isNew ? { id:'',nombre:'',tagline:'',precio:'',descripcion:'',mapEmbed:'',incluye:[],itinerario:[] }
                      : JSON.parse(JSON.stringify(globalData.packagesData.es[idx]));
    document.getElementById('pkg-id').value = pkg.id;
    document.getElementById('pkg-nombre').value = pkg.nombre;
    document.getElementById('pkg-tagline').value = pkg.tagline;
    document.getElementById('pkg-precio').value = pkg.precio.replace('Q.', '').trim();
    document.getElementById('pkg-descripcion').value = pkg.descripcion || '';
    document.getElementById('pkg-mas_info').value = pkg.mas_info || '';
    document.getElementById('pkg-mapEmbed').value = pkg.mapEmbed || '';
    document.getElementById('pkg-imagen-url').value = pkg.imagen || '';
    const inclEl = document.getElementById('pkg-incluye-list'); inclEl.innerHTML = '';
    (pkg.incluye || []).forEach(item => inclEl.appendChild(makePkgIncluyeRow(item)));
    const itinEl = document.getElementById('pkg-itin-list'); itinEl.innerHTML = '';
    (pkg.itinerario || []).forEach(it => itinEl.appendChild(makePkgItinRow(it.t, it.d)));
    openModal('pkg-modal'); lucide.createIcons();
}

function makePkgIncluyeRow(val = '') {
    const div = document.createElement('div'); div.className = 'flex gap-2 items-center';
    div.innerHTML = `<input type="text" value="${val}" placeholder="Ej: Vuelos incluidos" class="field-input flex-1">
        <button type="button" onclick="this.parentElement.remove()" class="text-red-400 hover:text-red-600 p-1"><i data-lucide="trash-2" class="w-4 h-4"></i></button>`;
    return div;
}
function addPkgIncluye() { document.getElementById('pkg-incluye-list').appendChild(makePkgIncluyeRow('')); lucide.createIcons(); }

function makePkgItinRow(t = '', d = '') {
    const div = document.createElement('div'); div.className = 'itin-row';
    div.innerHTML = `<input type="text" value="${t}" placeholder="Título (ej: Día 1)" class="field-input">
        <input type="text" value="${d}" placeholder="Descripción del día" class="field-input">
        <button type="button" onclick="this.parentElement.remove()" class="text-red-400 hover:text-red-600 p-1"><i data-lucide="trash-2" class="w-4 h-4"></i></button>`;
    return div;
}
function addPkgItin() { document.getElementById('pkg-itin-list').appendChild(makePkgItinRow('','')); lucide.createIcons(); }

function savePaquete() {
    const idx = document.getElementById('pkg-idx').value;
    const isNew = idx === '';
    const inclRows = document.getElementById('pkg-incluye-list').querySelectorAll('input[type="text"]');
    const itinRows = document.getElementById('pkg-itin-list').querySelectorAll('.itin-row');
    const pkg = {
        id: document.getElementById('pkg-id').value.trim(),
        nombre: document.getElementById('pkg-nombre').value.trim(),
        tagline: document.getElementById('pkg-tagline').value.trim(),
        precio: 'Q.' + document.getElementById('pkg-precio').value.trim(),
        descripcion: document.getElementById('pkg-descripcion').value.trim(),
        mas_info: document.getElementById('pkg-mas_info').value.trim(),
        mapEmbed: document.getElementById('pkg-mapEmbed').value.trim(),
        imagen: document.getElementById('pkg-imagen-url').value.trim(),
        incluye: [...inclRows].map(i => i.value.trim()).filter(Boolean),
        itinerario: [...itinRows].map(row => { const inp = row.querySelectorAll('input'); return { t: inp[0].value.trim(), d: inp[1].value.trim() }; }).filter(it => it.t || it.d)
    };
    if (!pkg.id || !pkg.nombre) { showToast('El ID y el Nombre son obligatorios.', 'error'); return; }
    if (!globalData.packagesData) globalData.packagesData = { es: [] };
    if (isNew) globalData.packagesData.es.push(pkg);
    else globalData.packagesData.es[parseInt(idx)] = pkg;
    closeModal('pkg-modal'); renderPaquetes();
    showToast(isNew ? 'Paquete creado. Recuerda guardar.' : 'Paquete actualizado. Recuerda guardar.', 'success');
}

function deletePaquete(idx) {
    if (!confirm('¿Eliminar este paquete?')) return;
    globalData.packagesData.es.splice(idx, 1);
    renderPaquetes(); showToast('Paquete eliminado. Recuerda guardar.', 'info');
}

/* ══════════════ IMÁGENES ══════════════ */
function renderImagenes() {
    const list = document.getElementById('imagenes-list'); list.innerHTML = '';
    Object.entries(globalData.imagesMap || {}).forEach(([k, v]) => list.appendChild(makeImageRow(k, v)));
    lucide.createIcons();
}
function makeImageRow(key = '', val = '') {
    const div = document.createElement('div'); div.className = 'grid gap-3 items-center' ; div.style.gridTemplateColumns = '1fr 2fr auto';
    div.innerHTML = `<input type="text" value="${key}" placeholder="ID (ej: cancun)" class="field-input img-key">
        <input type="text" value="${val}" placeholder="assets/images/cancun.jpg" class="field-input img-val">
        <button type="button" onclick="this.parentElement.remove(); syncImagesFromDOM();" class="text-red-400 hover:text-red-600 p-1"><i data-lucide="trash-2" class="w-4 h-4"></i></button>`;
    div.querySelectorAll('input').forEach(inp => inp.addEventListener('change', syncImagesFromDOM));
    return div;
}
function addImageRow() { document.getElementById('imagenes-list').appendChild(makeImageRow('', '')); lucide.createIcons(); }
function syncImagesFromDOM() {
    const rows = document.getElementById('imagenes-list').children;
    const map = {};
    [...rows].forEach(row => { const k = row.querySelector('.img-key')?.value.trim(); const v = row.querySelector('.img-val')?.value.trim(); if (k) map[k] = v || ''; });
    globalData.imagesMap = map;
}

/* ══════════════ SALIDAS ══════════════ */
function renderSalidas() {
    const list = document.getElementById('salidas-list');
    const trips = globalData.scheduledTrips || [];
    if (!trips.length) { list.innerHTML = '<p class="text-slate-400 text-sm">No hay salidas programadas.</p>'; return; }
    list.innerHTML = '';
    trips.forEach((trip, i) => {
        const estadoBadge = { available:'bg-emerald-100 text-emerald-700', few:'bg-orange-100 text-orange-700', full:'bg-slate-100 text-slate-500' }[trip.estado] || 'bg-slate-100 text-slate-500';
        const estadoLabel = { available:'Disponible', few:'Últimos cupos', full:'Lleno' }[trip.estado] || trip.estado;
        const card = document.createElement('div'); card.className = 'card flex flex-col md:flex-row md:items-center gap-4';
        card.innerHTML = `
            <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-center gap-2 mb-1">
                    <span class="text-xs font-black text-sky-500 uppercase tracking-widest">${trip.id}</span>
                    <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${estadoBadge}">${estadoLabel}</span>
                    <span class="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">${trip.categoria}</span>
                </div>
                <p class="font-bold text-slate-800">${trip.destino?.es || ''}</p>
                <p class="text-xs text-slate-400">${trip.fecha?.es || ''} · ${trip.noches} noches · ${trip.precio?.es || ''}</p>
            </div>
            <div class="flex gap-2">
                <button onclick="openSalidaModal(${i})" class="btn-ghost"><i data-lucide="pencil" class="w-4 h-4"></i> Editar</button>
                <button onclick="deleteSalida(${i})" class="btn-danger"><i data-lucide="trash-2" class="w-4 h-4"></i> Eliminar</button>
            </div>`;
        list.appendChild(card);
    });
    lucide.createIcons();
}

function openSalidaModal(idx) {
    const isNew = idx === null;
    document.getElementById('salida-modal-title').innerText = isNew ? 'Nueva Salida' : 'Editar Salida';
    document.getElementById('salida-idx').value = isNew ? '' : idx;
    const trip = isNew
        ? { id:'',categoria:'grupal',destino:{es:''},fecha:{es:''},noches:1,tipo:{es:''},precio:{es:''},estado:'available',cuposLibres:'',tag:{es:''},imagen:'',mapEmbed:'',descripcion:{es:''},incluye:{es:[]},itinerario:{es:[]} }
        : JSON.parse(JSON.stringify(globalData.scheduledTrips[idx]));
    document.getElementById('salida-id').value = trip.id;
    document.getElementById('salida-categoria').value = trip.categoria || 'grupal';
    document.getElementById('salida-destino').value = trip.destino?.es || '';
    document.getElementById('salida-fecha').value = dateToInput(trip.fecha?.es);
    document.getElementById('salida-noches').value = trip.noches || 1;
    document.getElementById('salida-tipo').value = trip.tipo?.es || '';
    document.getElementById('salida-precio').value = (trip.precio?.es || '').replace('Q.', '').trim();
    document.getElementById('salida-estado').value = trip.estado || 'available';
    document.getElementById('salida-cupos').value = trip.cuposLibres || '';
    document.getElementById('salida-tag').value = trip.tag?.es || '';
    document.getElementById('salida-imagen').value = trip.imagen || '';
    document.getElementById('salida-mapEmbed').value = trip.mapEmbed || '';
    document.getElementById('salida-descripcion').value = trip.descripcion?.es || '';
    document.getElementById('salida-mas_info').value = trip.mas_info?.es || '';
    const inclEl = document.getElementById('salida-incluye-list'); inclEl.innerHTML = '';
    (trip.incluye?.es || []).forEach(item => inclEl.appendChild(makeSalidaIncluyeRow(item)));
    const itinEl = document.getElementById('salida-itin-list'); itinEl.innerHTML = '';
    (trip.itinerario?.es || []).forEach(it => itinEl.appendChild(makeSalidaItinRow(it.t, it.d)));
    openModal('salida-modal'); lucide.createIcons();
}

function makeSalidaIncluyeRow(val = '') {
    const div = document.createElement('div'); div.className = 'flex gap-2 items-center';
    div.innerHTML = `<input type="text" value="${val}" placeholder="Ej: Traslados incluidos" class="field-input flex-1">
        <button type="button" onclick="this.parentElement.remove()" class="text-red-400 hover:text-red-600 p-1"><i data-lucide="trash-2" class="w-4 h-4"></i></button>`;
    return div;
}
function addSalidaIncluye() { document.getElementById('salida-incluye-list').appendChild(makeSalidaIncluyeRow('')); lucide.createIcons(); }

function makeSalidaItinRow(t = '', d = '') {
    const div = document.createElement('div'); div.className = 'itin-row';
    div.innerHTML = `<input type="text" value="${t}" placeholder="Título (ej: Día 1)" class="field-input">
        <input type="text" value="${d}" placeholder="Descripción del día" class="field-input">
        <button type="button" onclick="this.parentElement.remove()" class="text-red-400 hover:text-red-600 p-1"><i data-lucide="trash-2" class="w-4 h-4"></i></button>`;
    return div;
}
function addSalidaItin() { document.getElementById('salida-itin-list').appendChild(makeSalidaItinRow('','')); lucide.createIcons(); }

function saveSalida() {
    const idx = document.getElementById('salida-idx').value;
    const isNew = idx === '';
    const inclRows = document.getElementById('salida-incluye-list').querySelectorAll('input[type="text"]');
    const itinRows = document.getElementById('salida-itin-list').querySelectorAll('.itin-row');
    const id = document.getElementById('salida-id').value.trim();
    if (!id) { showToast('El ID es obligatorio.', 'error'); return; }
    const trip = {
        id, categoria: document.getElementById('salida-categoria').value,
        destino: { es: document.getElementById('salida-destino').value.trim() },
        fecha: { es: dateToJSON(document.getElementById('salida-fecha').value) },
        noches: parseInt(document.getElementById('salida-noches').value) || 1,
        tipo: { es: document.getElementById('salida-tipo').value.trim() },
        precio: { es: 'Q.' + document.getElementById('salida-precio').value.trim() },
        estado: document.getElementById('salida-estado').value,
        cuposLibres: document.getElementById('salida-cupos').value.trim(),
        tag: { es: document.getElementById('salida-tag').value.trim() },
        imagen: document.getElementById('salida-imagen').value.trim(),
        mapEmbed: document.getElementById('salida-mapEmbed').value.trim(),
        descripcion: { es: document.getElementById('salida-descripcion').value.trim() },
        mas_info: { es: document.getElementById('salida-mas_info').value.trim() },
        incluye: { es: [...inclRows].map(i => i.value.trim()).filter(Boolean) },
        itinerario: { es: [...itinRows].map(row => { const inp = row.querySelectorAll('input'); return { t: inp[0].value.trim(), d: inp[1].value.trim() }; }).filter(it => it.t || it.d) }
    };
    if (!globalData.scheduledTrips) globalData.scheduledTrips = [];
    if (isNew) globalData.scheduledTrips.push(trip);
    else globalData.scheduledTrips[parseInt(idx)] = trip;
    closeModal('salida-modal'); renderSalidas();
    showToast(isNew ? 'Salida creada. Recuerda guardar.' : 'Salida actualizada. Recuerda guardar.', 'success');
}

function deleteSalida(idx) {
    if (!confirm('¿Eliminar esta salida?')) return;
    globalData.scheduledTrips.splice(idx, 1);
    renderSalidas(); showToast('Salida eliminada. Recuerda guardar.', 'info');
}
