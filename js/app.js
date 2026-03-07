/* =========================================
   VIAJES LA MAR — App Logic
   Depende de: data.json | Lucide Icons CDN
   ========================================= */

'use strict';

/* ------------------------------------------
   Estado global de la aplicación
------------------------------------------ */
let currentLang = 'es';
let paqueteActivoId = 'cancun';

// Variables que se cargarán desde el JSON
let translations = null;
let packagesData = null;
let imagesMap = null;
let scheduledTrips = null;

/* ------------------------------------------
   Utilidades
------------------------------------------ */

/**
 * Escapa texto para prevenir inyección XSS.
 * @param {string} text
 * @returns {string}
 */
function sanitize(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/* ------------------------------------------
   Internacionalización (i18n)
------------------------------------------ */

/**
 * Cambia el idioma de toda la interfaz.
 * @param {'es'|'en'} lang
 */
function setLanguage(lang) {
    currentLang = lang;

    // Actualizar visual del selector de idioma (Estilo Pill)
    const indicator = document.getElementById('lang-indicator');
    const btnEs = document.getElementById('lang-es');
    const btnEn = document.getElementById('lang-en');

    if (indicator && btnEs && btnEn) {
        if (lang === 'es') {
            indicator.style.transform = 'translateX(0)';
            btnEs.classList.add('text-white');
            btnEs.classList.remove('text-slate-400');
            btnEn.classList.add('text-slate-400');
            btnEn.classList.remove('text-white');
        } else {
            indicator.style.transform = 'translateX(100%)';
            btnEn.classList.add('text-white');
            btnEn.classList.remove('text-slate-400');
            btnEs.classList.add('text-slate-400');
            btnEs.classList.remove('text-white');
        }
    }

    // Actualizar elementos text con data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.innerHTML = translations[lang][key] ?? key;
    });

    // Actualizar placeholders bilingüe
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = translations[lang][key] ?? key;
    });

    // Re-renderizar componentes dinámicos
    renderHomeDestinations();
    renderCalendar();
    renderPaquete(paqueteActivoId);
}

/* ------------------------------------------
   Navegación entre páginas (SPA)
------------------------------------------ */

/**
 * Muestra la página indicada y oculta el resto.
 * @param {'inicio'|'paquetes'|'detalle-viaje'|'grupales'|'promociones'} pageId
 */
function showPage(pageId) {
    // Si la página solicitada es 'grupales' o 'promociones', mapeamos ambas a 'page-salidas' visualmente
    const targetDiv = (pageId === 'grupales' || pageId === 'promociones') ? 'salidas' : pageId;
    const pages = ['inicio', 'paquetes', 'detalle-viaje', 'salidas'];

    pages.forEach(id => {
        const el = document.getElementById(`page-${id}`);
        if (el) el.classList.toggle('hidden', id !== targetDiv);
    });

    // Controlar enlaces nav-link-active en escritorio
    ['inicio', 'paquetes', 'grupales', 'promociones'].forEach(id => {
        const nav = document.getElementById(`nav-${id}`);
        if (nav) nav.classList.toggle('nav-link-active', id === pageId);
    });

    if (pageId === 'paquetes') {
        renderPaquete(paqueteActivoId);
    }
    else if (pageId === 'grupales' || pageId === 'promociones') {
        // Cambiar títulos y estado antes de pintar la tabla
        let titleEl = document.getElementById('page-salidas-title');
        let descEl = document.getElementById('page-salidas-desc');

        if (pageId === 'grupales') {
            currentCalendarTab = 'grupal';
        } else {
            currentCalendarTab = 'promocion';
        }

        // Usar i18n para actualizar títulos y descripciones
        if (titleEl) {
            const key = pageId === 'grupales' ? 'cal_tab_grupal' : 'cal_tab_promo';
            titleEl.setAttribute('data-i18n', key);
            titleEl.innerHTML = translations[currentLang][key] || key;
        }
        if (descEl) {
            const key = pageId === 'grupales' ? 'sched_subtitle_group' : 'sched_subtitle_promo';
            descEl.setAttribute('data-i18n', key);
            descEl.innerHTML = translations[currentLang][key] || key;
        }

        // Renderizar tabla
        renderCalendar();
    }

    // Volver arriba de forma suave
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Abre o cierra el menú lateral en dispositivos móviles.
 */
function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    if (!menu) return;

    if (menu.classList.contains('translate-x-full')) {
        menu.classList.remove('translate-x-full');
        menu.classList.add('translate-x-0');
        document.body.classList.add('overflow-hidden');
    } else {
        menu.classList.remove('translate-x-0');
        menu.classList.add('translate-x-full');
        document.body.classList.remove('overflow-hidden');
    }
}

/* ------------------------------------------
   Sección Inicio — Grid de destinos
 ------------------------------------------ */

/**
 * Genera las tarjetas de destino destacados en la página de inicio.
 */
function renderHomeDestinations() {
    const grid = document.getElementById('home-destinations-grid');
    if (!grid || !packagesData) return;

    const label = translations[currentLang].more_details;
    const desde = currentLang === 'es' ? 'Desde' : 'From';

    grid.innerHTML = packagesData[currentLang].map((pkg, index) => {
        // La primera tarjeta inicia expandida (flex-[4])
        const flexClass = index === 0 ? 'flex-[4]' : 'flex-[1]';
        const opacityClass = index === 0 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4';
        const titleClass = index === 0 ? 'md:-rotate-0 md:whitespace-normal md:w-auto' : 'md:-rotate-90 md:whitespace-nowrap md:w-16';

        return `
        <div
            class="accordion-item relative overflow-hidden rounded-3xl cursor-pointer transition-[flex] duration-700 ease-out min-h-[120px] md:min-h-0 group ${flexClass}"
            onclick="toggleAccordion(this, '${pkg.id}')"
            role="button"
            aria-label="Ver paquete ${pkg.nombre}"
        >
            <img src="${imagesMap[pkg.id]}"
                 alt="${pkg.nombre}"
                 class="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                 loading="lazy">
            <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
            
            <div class="absolute inset-0 p-6 flex flex-col justify-end">
                <div class="flex items-end justify-between transition-all duration-700 origin-left ${titleClass} accordion-title-container">
                    <div>
                        <span class="text-bayau font-bold text-[9px] tracking-[0.3em] uppercase drop-shadow-md">${pkg.tagline}</span>
                        <h3 class="font-league text-3xl md:text-5xl text-white mt-1 drop-shadow-lg">${pkg.nombre}</h3>
                    </div>
                </div>
                
                <div class="accordion-content transition-all duration-700 ease-out mt-4 ${opacityClass}">
                    <p class="text-sm font-bold text-white/80 italic mb-4">${desde} ${pkg.precio}</p>
                    <button onclick="goPaquete('${pkg.id}'); event.stopPropagation();"
                         class="bg-bayau text-white px-6 py-3 rounded-full font-bold tracking-[0.2em] text-xs flex items-center gap-2 hover:bg-white hover:text-coronation transition shadow-lg w-max">
                        ${label} <i data-lucide="arrow-right" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
        </div>
        `;
    }).join('');

    lucide.createIcons();
}

/**
 * Función para expandir/colapsar elementos del acordeón
 * @param {HTMLElement} element El elemento clickeado
 * @param {string} id ID del paquete asociado
 */
function toggleAccordion(element, id) {
    const grid = document.getElementById('home-destinations-grid');
    if (!grid) return;

    // Obtener todos los items del acordeón
    const items = Array.from(grid.querySelectorAll('.accordion-item'));

    // Si ya está activo, no hacer nada
    if (element.classList.contains('flex-[4]')) return;

    items.forEach((item, index) => {
        const isTarget = item === element;

        // Clases de flex (Expansión)
        item.classList.remove(isTarget ? 'flex-[1]' : 'flex-[4]');
        item.classList.add(isTarget ? 'flex-[4]' : 'flex-[1]');

        // Elemento de Contenido (Precio, Botón)
        const content = item.querySelector('.accordion-content');
        if (content) {
            if (isTarget) {
                content.classList.remove('opacity-0', 'translate-y-4');
                content.classList.add('opacity-100', 'translate-y-0');
            } else {
                content.classList.remove('opacity-100', 'translate-y-0');
                content.classList.add('opacity-0', 'translate-y-4');
            }
        }

        // Título Vertical vs Horizontal para Desktop
        const titleContainer = item.querySelector('.accordion-title-container');
        if (titleContainer) {
            if (isTarget) {
                titleContainer.classList.remove('md:-rotate-90', 'md:whitespace-nowrap', 'md:w-16');
                titleContainer.classList.add('md:-rotate-0', 'md:whitespace-normal', 'md:w-auto');
            } else {
                titleContainer.classList.remove('md:-rotate-0', 'md:whitespace-normal', 'md:w-auto');
                titleContainer.classList.add('md:-rotate-90', 'md:whitespace-nowrap', 'md:w-16');
            }
        }

        // --- Animación del Bus Guatemalteco ---
        if (isTarget) {
            const bus = document.getElementById('chicken-bus');
            if (bus) {
                // Calcular avance basado en la cantidad de tarjetas
                // Usamos un maxTravel de 80% para que el bus (que tiene ancho visual) no se salga del contenedor
                const maxTravel = 80;
                const travelPercent = items.length > 1 ? (index / (items.length - 1)) * maxTravel : 0;
                // Asignar left para que viaje relativo al contenedor de forma segura
                bus.style.left = `${travelPercent}%`;
            }
        }
    });
}

/**
 * Navega a la sección de paquetes con el destino seleccionado.
 * @param {string} id
 */
function goPaquete(id) {
    paqueteActivoId = id;
    showPage('paquetes');
}


/* ------------------------------------------
   Sección Calendario — Salidas Programadas
------------------------------------------ */
let currentCalendarTab = 'grupal'; // Pestaña por defecto controlada desde showPage()

/**
 * Renderiza la tabla de salidas programadas filtrada por pestaña (en su propia página).
 */
function renderCalendar() {
    const tbody = document.getElementById('calendar-table-body');
    if (!tbody || !scheduledTrips) return;

    // Filtrar los viajes según la pestaña activa
    const filteredTrips = scheduledTrips.filter(trip => trip.categoria === currentCalendarTab);

    if (filteredTrips.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="px-8 py-10 text-center text-slate-400 font-bold tracking-widest uppercase text-xs">No hay viajes programados en esta categoría actualmente.</td></tr>`;
        return;
    }

    tbody.innerHTML = filteredTrips.map(trip => {
        const statusText = trip.estado === 'available' ? (currentLang === 'es' ? 'Disponible' : 'Available') : (trip.estado === 'few' ? (currentLang === 'es' ? 'Últimos cupos' : 'Last spots') : (currentLang === 'es' ? 'Lleno' : 'Full'));
        const statusClass = trip.estado === 'available' ? 'bg-bayau/10 text-bayau' : (trip.estado === 'few' ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-400');

        return `
            <tr class="border-b border-slate-50 hover:bg-slate-50 transition">
                <td class="px-8 py-6">
                    <span class="block text-sm font-bold text-coronation uppercase tracking-tighter">${trip.fecha[currentLang]}</span>
                    <span class="text-xs text-slate-400 uppercase tracking-widest font-black">${trip.noches} ${currentLang === 'es' ? 'noches' : 'nights'}</span>
                </td>
                <td class="px-8 py-6">
                    <span class="block text-base font-bold text-coronation uppercase tracking-tighter">${trip.destino[currentLang]}</span>
                    <span class="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${statusClass} mt-1">${statusText}</span>
                </td>
                <td class="px-8 py-6 hidden md:table-cell">
                    <span class="text-sm font-bold text-slate-400 uppercase tracking-widest">${trip.tipo[currentLang]}</span>
                </td>
                <td class="px-8 py-6 text-right">
                    <button class="inline-block px-5 py-3 border-2 border-slate-200 text-coronation font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-slate-50 transition"
                        data-i18n="sched_btn" onclick="goTripDetail('${trip.id}')">Ver detalle</button>
                </td>
            </tr>
        `;
    }).join('');

    lucide.createIcons();
}

/**
 * Renderiza la tabla completa de programación en la Página Principal (Home).
 */
function renderHomeCalendar() {
    const tbody = document.getElementById('home-calendar-table-body');
    if (!tbody || !scheduledTrips) return;

    if (scheduledTrips.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="px-8 py-10 text-center text-slate-400 font-bold tracking-widest uppercase text-xs">No hay viajes programados actualmente.</td></tr>`;
        return;
    }

    tbody.innerHTML = scheduledTrips.map(trip => {
        const statusText = trip.estado === 'available' ? (currentLang === 'es' ? 'Disponible' : 'Available') : (trip.estado === 'few' ? (currentLang === 'es' ? 'Últimos cupos' : 'Last spots') : (currentLang === 'es' ? 'Lleno' : 'Full'));
        const statusClass = trip.estado === 'available' ? 'bg-bayau/10 text-bayau' : (trip.estado === 'few' ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-400');

        return `
            <tr class="border-b border-slate-50 hover:bg-slate-50 transition">
                <td class="px-8 py-6">
                    <span class="block text-sm font-bold text-coronation uppercase tracking-tighter">${trip.fecha[currentLang]}</span>
                    <span class="text-xs text-slate-400 uppercase tracking-widest font-black">${trip.noches} ${currentLang === 'es' ? 'noches' : 'nights'}</span>
                </td>
                <td class="px-8 py-6">
                    <span class="block text-base font-bold text-coronation uppercase tracking-tighter">${trip.destino[currentLang]}</span>
                    <span class="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${statusClass} mt-1">${statusText}</span>
                </td>
                <td class="px-8 py-6 hidden md:table-cell">
                    <span class="text-sm font-bold text-slate-400 uppercase tracking-widest">${trip.tipo[currentLang]}</span>
                </td>
                <td class="px-8 py-6 text-right">
                    <button class="inline-block px-5 py-3 border-2 border-slate-200 text-coronation font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-slate-50 transition"
                        data-i18n="sched_btn" onclick="goTripDetail('${trip.id}')">Ver detalle</button>
                </td>
            </tr>
        `;
    }).join('');

    lucide.createIcons();
}

/**
 * Navega a la página de detalle de un viaje programado.
 * @param {string} id 
 */
function goTripDetail(id) {
    if (!scheduledTrips) return;
    const trip = scheduledTrips.find(t => t.id === id);
    if (!trip) return;

    renderTripDetail(trip);
    showPage('detalle-viaje');
}

/**
 * Renderiza la información de un viaje programado en su página de detalle.
 * @param {object} trip 
 */
function renderTripDetail(trip) {
    document.getElementById('trip-hero-img').src = trip.imagen;
    document.getElementById('trip-hero-tag').innerText = trip.tag[currentLang];
    document.getElementById('trip-hero-title').innerText = trip.destino[currentLang];
    document.getElementById('trip-hero-date').innerText = trip.fecha[currentLang];
    document.getElementById('trip-hero-nights').innerText = `${trip.noches} ${currentLang === 'es' ? 'NOCHES' : 'NIGHTS'}`;

    document.getElementById('trip-price').innerText = trip.precio[currentLang];
    document.getElementById('trip-cupos').innerText = `${trip.cuposLibres} ${currentLang === 'es' ? 'CUPOS DISPONIBLES' : 'SPOTS AVAILABLE'}`;

    // Incluye
    document.getElementById('trip-incluye').innerHTML = trip.incluye[currentLang].map(item => `
        <div class="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div class="w-8 h-8 rounded-xl bg-bayau/10 flex items-center justify-center text-bayau">
                <i data-lucide="check" class="w-4 h-4"></i>
            </div>
            <span class="text-xs font-bold text-coronation uppercase tracking-widest">${item}</span>
        </div>
    `).join('');

    // Itinerario
    document.getElementById('trip-itinerario').innerHTML = trip.itinerario[currentLang].map((step, idx) => `
        <div class="relative pl-5 md:pl-10 pb-0 md:pb-8 border-l-2 border-slate-100 last:pb-0">
            <div class="absolute -left-[11px] top-0 w-5 h-5 rounded-full bg-coronation border-4 border-white"></div>
            <div class="bg-white px-3 py-2 md:p-5 rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition">
                <div class="flex items-center gap-2 mb-1">
                    <span class="text-[9px] font-black text-bayau tracking-[0.2em] uppercase whitespace-nowrap">Día ${idx + 1}</span>
                    <h4 class="font-bold text-coronation text-sm md:text-lg uppercase tracking-tighter truncate">${step.t}</h4>
                </div>
                <p class="text-[10px] md:text-xs text-slate-500 leading-tight">${step.d}</p>
            </div>
        </div>
    `).join('');

    // Botón de WhatsApp
    const btn = document.getElementById('btn-reserve-trip');
    if (btn) {
        btn.onclick = () => {
            const msg = encodeURIComponent(`Hola Viajes La Mar, me interesa reservar mi cupo para el viaje grupal a ${trip.destino.es} en la fecha ${trip.fecha.es}.`);
            window.open(`https://wa.me/50223764607?text=${msg}`, '_blank', 'noopener,noreferrer');
        };
    }

    // Mapa
    const mapFrame = document.getElementById('trip-map-frame');
    const mapContainer = document.getElementById('trip-mapa-container');
    if (mapFrame && mapContainer) {
        if (trip.mapEmbed) {
            mapFrame.src = trip.mapEmbed;
            mapContainer.parentElement.classList.remove('hidden');
        } else {
            mapContainer.parentElement.classList.add('hidden');
        }
    }

    lucide.createIcons();
}

/* ------------------------------------------
   Sección Paquetes — Detalle de destino
------------------------------------------ */

/**
 * Renderiza la vista detallada de un paquete.
 * @param {string} id
 */
function renderPaquete(id) {
    if (!packagesData) return;
    const pkg = packagesData[currentLang].find(p => p.id === id);
    if (!pkg) return;
    paqueteActivoId = id;

    // Hero
    document.getElementById('pkg-hero-img').src = imagesMap[id];
    document.getElementById('pkg-hero-title').innerText = pkg.nombre;
    document.getElementById('pkg-hero-tag').innerText = pkg.tagline;

    // Precio
    document.getElementById('pkg-price').innerText = pkg.precio;

    // Tab: Lo que incluye
    document.getElementById('pkg-tab-incluye').innerHTML = pkg.incluye.map(item => `
        <div class="flex items-center space-x-3 p-3 md:p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <i data-lucide="check-circle" class="w-5 h-5 text-bayau flex-shrink-0"></i>
            <span class="text-xs font-bold text-coronation uppercase tracking-wider">${item}</span>
        </div>
    `).join('');

    // Tab: Itinerario
    document.getElementById('pkg-tab-itinerario').innerHTML = pkg.itinerario.map(it => `
        <div class="relative pl-5 md:pl-8 border-l-2 border-slate-100 pb-0 md:pb-6 last:pb-0">
            <div class="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-coronation border-4 border-white"></div>
            <h4 class="font-bold text-coronation text-[10px] md:text-xs uppercase tracking-widest mb-1">${it.t}</h4>
            <p class="text-[10px] md:text-xs text-slate-500 leading-tight">${it.d}</p>
        </div>
    `).join('');

    // Mapa
    const mapFrame = document.getElementById('pkg-map-frame');
    if (mapFrame) {
        mapFrame.src = pkg.mapEmbed || "";
    }

    // Selector horizontal de paquetes
    document.getElementById('pkg-selector').innerHTML = packagesData[currentLang].map(p => `
        <button
            onclick="renderPaquete('${p.id}')"
            class="${p.id === id
            ? 'text-bayau border-b-2 border-bayau pb-2'
            : 'hover:text-coronation'} transition uppercase tracking-widest px-2"
        >
            ${p.nombre}
        </button>
    `).join('');

    switchPkgTab('incluye');
    lucide.createIcons();
}

/**
 * Alterna entre las pestañas "Incluye" e "Itinerario".
 * @param {'incluye'|'itinerario'} tab
 */
function switchPkgTab(tab) {
    const inclPanel = document.getElementById('pkg-tab-incluye');
    const itinPanel = document.getElementById('pkg-tab-itinerario');
    const mapaPanel = document.getElementById('pkg-tab-mapa');

    const inclBtn = document.getElementById('btn-pkg-incluye');
    const itinBtn = document.getElementById('btn-pkg-itinerario');
    const mapaBtn = document.getElementById('btn-pkg-mapa');

    if (inclPanel) inclPanel.classList.toggle('hidden', tab !== 'incluye');
    if (itinPanel) itinPanel.classList.toggle('hidden', tab !== 'itinerario');
    if (mapaPanel) mapaPanel.classList.toggle('hidden', tab !== 'mapa');

    if (inclBtn) inclBtn.classList.toggle('tab-active', tab === 'incluye');
    if (itinBtn) itinBtn.classList.toggle('tab-active', tab === 'itinerario');
    if (mapaBtn) mapaBtn.classList.toggle('tab-active', tab === 'mapa');
}

/* ------------------------------------------
   Formularios → WhatsApp
------------------------------------------ */

/** Cotización general desde la sección de inicio */
document.getElementById('safeForm').addEventListener('submit', function (e) {
    e.preventDefault();
    const name = sanitize(document.getElementById('f-name').value.trim());
    const phone = sanitize(document.getElementById('f-phone').value.trim());
    const dest = sanitize(document.getElementById('f-dest').value.trim());

    const msg = encodeURIComponent(
        `Hola Viajes La Mar, me llamo ${name}. Quiero cotizar un viaje a: ${dest}. Tel: ${phone}`
    );
    window.open(`https://wa.me/50223764607?text=${msg}`, '_blank', 'noopener,noreferrer');
});

/** Reserva de un paquete específico */
document.getElementById('pkgQuoteForm').addEventListener('submit', function (e) {
    e.preventDefault();
    const name = sanitize(document.getElementById('pkg-u-name').value.trim());
    const phone = sanitize(document.getElementById('pkg-u-phone').value.trim());
    const pkg = packagesData[currentLang].find(p => p.id === paqueteActivoId);

    const msg = encodeURIComponent(
        `¡Hola! Me interesa reservar el paquete de ${pkg.nombre}. Mi nombre es ${name} y mi número es ${phone}.`
    );
    window.open(`https://wa.me/50223764607?text=${msg}`, '_blank', 'noopener,noreferrer');
});

/** Botón "Contactar Ahora" del hero */
function contactGeneral() {
    const msg = encodeURIComponent("Hola Viajes La Mar, deseo recibir información sobre sus paquetes.");
    window.open(`https://wa.me/50223764607?text=${msg}`, '_blank', 'noopener,noreferrer');
}

/* ------------------------------------------
   Efectos Visuales — Scroll & Reveal
------------------------------------------ */

/**
 * Controla efectos que dependen del scroll (Reveal & Header sticky).
 */
function handleScroll() {
    // 1. Efecto de elevación del Header
    const header = document.getElementById('main-header');
    const container = document.getElementById('header-container');

    if (header && container) {
        if (window.scrollY > 50) {
            header.classList.add('shadow-xl');
            header.classList.replace('h-24', 'h-20');
            container.classList.replace('h-24', 'h-20');
        } else {
            header.classList.remove('shadow-xl');
            header.classList.replace('h-20', 'h-24');
            container.classList.replace('h-20', 'h-24');
        }
    }

    // 2. Reveal on Scroll
    const reveals = document.querySelectorAll('.reveal');
    reveals.forEach(el => {
        const windowHeight = window.innerHeight;
        const elementTop = el.getBoundingClientRect().top;
        const elementVisible = 150;

        if (elementTop < windowHeight - elementVisible) {
            el.classList.add('active');
        }
    });
}

window.addEventListener('scroll', handleScroll);

/* ------------------------------------------
   Inicialización
------------------------------------------ */
async function init() {
    try {
        const response = await fetch('js/data.json');
        const data = await response.json();

        translations = data.translations;
        packagesData = data.packagesData;
        imagesMap = data.imagesMap;
        scheduledTrips = data.scheduledTrips;

        lucide.createIcons();
        renderHomeDestinations();
        renderCalendar();
        renderHomeCalendar(); // Pinta el calendario maestro en el Inicio
        showPage('inicio');

        // Ejecutar una vez para activar lo que ya es visible
        handleScroll();
    } catch (error) {
        console.error('Error cargando los datos:', error);
    }
}

// Iniciar aplicación
init();
