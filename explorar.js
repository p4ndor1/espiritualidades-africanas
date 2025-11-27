// explorar.js - Versão Final: Busca em Transcrições, Filtros Dinâmicos e Datas Corrigidas

let fullData = {};
let filteredRecords = [];
let map = null;
let markersCluster = null;

// Elementos do DOM
const recordsContainer = document.getElementById('result-list');
const detailContainer = document.getElementById('document-detail');
const dynamicFiltersContainer = document.getElementById('dynamic-filters');
const entityFilter = document.getElementById('entity-filter');
const searchInput = document.getElementById('search-text');
const resultsCountSpan = document.getElementById('results-count');

// --- Inicialização ---
const initPage = () => {
    try {
        if (typeof dbData === 'undefined') throw new Error("Variável 'dbData' não encontrada.");
        fullData = dbData;
        
        setupEventListeners();
        initMap();
        populateEntityFilter();
        generateDynamicFilters(); // Gera os filtros iniciais
        applyFilters(); // Carrega a lista inicial

    } catch (error) {
        console.error("Erro:", error);
        recordsContainer.innerHTML = `<li style="color:red; padding:10px;">Erro: ${error.message}</li>`;
    }
};

// --- Mapa (Dark Mode) ---
const initMap = () => {
    map = L.map('map-placeholder').setView([20, 0], 3);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom: 19
    }).addTo(map);

    markersCluster = L.markerClusterGroup({
        iconCreateFunction: function(cluster) {
            const count = cluster.getChildCount();
            let size = Math.min(30 + (count / 10), 60);
            const html = `<div style="background-color: #9B2915; color: white; border-radius: 50%; width:${size}px; height:${size}px; line-height:${size}px; text-align: center; font-weight: bold; border: 2px solid #E4D6A7;">${count}</div>`;
            return L.divIcon({ html: html, className: 'custom-cluster', iconSize: L.point(size, size) });
        }
    });
    map.addLayer(markersCluster);
};

const updateMapMarkers = (records) => {
    if (!map || !markersCluster) return;
    markersCluster.clearLayers();
    const validMarkers = [];

    records.forEach(record => {
        // Procura geolocalização em qualquer detalhe (para cobrir Pessoas e Documentos)
        const geoDetail = (record.details || []).find(d => d.fieldName.includes('Geolocalização'));
        
        if (geoDetail && geoDetail.value && geoDetail.value.geo && geoDetail.value.geo.wkt) {
            const coords = geoDetail.value.geo.wkt.match(/POINT\(\s*([-\d\.]+)\s+([-\d\.]+)\s*\)/);
            if (coords) {
                const lng = parseFloat(coords[1]); 
                const lat = parseFloat(coords[2]);
                const marker = L.marker([lat, lng]);
                
                let title = record.rec_Title ? record.rec_Title.replace(/\n/g, ' ') : "Item";
                
                marker.bindPopup(`
                    <strong style="color:#9B2915">${title}</strong><br>
                    <button onclick="displayRecordDetailsFromMap('${record.rec_ID}')" 
                            style="margin-top:5px; padding:4px 8px; background:#9B2915; color:white; border:none; border-radius:3px; cursor:pointer;">
                        Ver Detalhes
                    </button>
                `);
                markersCluster.addLayer(marker);
                validMarkers.push([lat, lng]);
            }
        }
    });

    if (validMarkers.length > 0) map.fitBounds(validMarkers, { padding: [50, 50], maxZoom: 8 });
    else map.setView([20, 0], 3);
};

window.displayRecordDetailsFromMap = (recID) => {
    const record = fullData.heurist.records.find(r => r.rec_ID === recID);
    if (record) {
        displayRecordDetails(record);
        document.getElementById('document-detail').scrollIntoView({ behavior: 'smooth' });
    }
};

// --- Filtros e Lógica de Busca ---
const populateEntityFilter = () => {
    const records = fullData.heurist.records || [];
    const entityTypes = new Set();
    
    records.forEach(r => { 
        // REMOVIDO: Relationship type não aparece mais
        if (r.rec_RecTypeName && r.rec_RecTypeName !== 'Record relationship') {
            entityTypes.add(r.rec_RecTypeName);
        }
    });
    
    const sortedTypes = Array.from(entityTypes).sort();
    entityFilter.innerHTML = '<option value="all">Todos</option>';
    sortedTypes.forEach(type => entityFilter.innerHTML += `<option value="${type}">${type}</option>`);
};

const generateDynamicFilters = () => {
    const records = fullData.heurist.records || [];
    const allFields = {};
    const selectedEntity = entityFilter.value;

    records.forEach(record => {
        const recType = record.rec_RecTypeName || "Outros";
        if (selectedEntity !== 'all' && recType !== selectedEntity) return;
        if (!allFields[recType]) allFields[recType] = new Map();

        (record.details || []).forEach(detail => {
            // Pula o campo Ano aqui, pois ele terá input próprio
            if (detail.fieldName === 'Ano(s) de produção') return;

            const isFilterable = ['enum', 'freetext', 'date'].includes(detail.fieldType) || !detail.fieldType;
            // Pula campos de texto longo nos filtros dropdown
            if (isFilterable && !detail.fieldName.includes('Transcrição') && detail.fieldName !== 'Resumo do documento') {
                let valueLabel = detail.termLabel || detail.value;
                if (typeof valueLabel === 'object' && valueLabel?.title) valueLabel = valueLabel.title;
                
                if (valueLabel) {
                    if (!allFields[recType].has(detail.fieldName)) allFields[recType].set(detail.fieldName, new Set());
                    allFields[recType].get(detail.fieldName).add(String(valueLabel).trim());
                }
            }
        });
    });

    dynamicFiltersContainer.innerHTML = '';
    
    // --- Input de DATA (Intervalo) ---
    // Aparece sempre, pois é útil para tudo
    dynamicFiltersContainer.innerHTML += `
        <div class="filter-group">
            <label style="color:var(--color-gold); font-weight:bold;">Ano (Intervalo):</label>
            <div style="display: flex; gap: 10px;">
                <input type="number" id="year-min" placeholder="De (ex: 1600)" class="dynamic-filter-year" style="width: 50%; padding:8px; background:rgba(0,0,0,0.3); border:1px solid var(--color-gold); color:white; border-radius:4px;">
                <input type="number" id="year-max" placeholder="Até (ex: 1800)" class="dynamic-filter-year" style="width: 50%; padding:8px; background:rgba(0,0,0,0.3); border:1px solid var(--color-gold); color:white; border-radius:4px;">
            </div>
        </div>
    `;

    // --- Configuração de Campos Prioritários ---
    // REMOVIDO: 'Ofício' foi retirado da lista geral
    let priorityFields = ['Local de referência', 'Qualidade ou cor', 'Condição jurídica', 'Nação'];
    
    // ADICIONADO: Filtros específicos para Pessoas
    if (selectedEntity === 'Pessoa') {
        priorityFields.push('Papel', 'Tipo de prática');
    } else if (selectedEntity === 'Documento') {
        priorityFields.push('Tipologia documental');
    }

    const entitiesProcess = selectedEntity === 'all' ? Object.keys(allFields) : [selectedEntity];
    const renderedFilters = new Set();

    entitiesProcess.forEach(entity => {
        if (allFields[entity]) {
            allFields[entity].forEach((valuesSet, fieldName) => {
                if (priorityFields.includes(fieldName) && !renderedFilters.has(fieldName)) {
                    renderedFilters.add(fieldName);
                    const values = Array.from(valuesSet).sort();
                    let html = `<div class="filter-group"><label style="color:var(--color-gold); font-weight:bold;">${fieldName}:</label><select class="dynamic-filter" data-field-name="${fieldName}"><option value="all">Todos</option>`;
                    values.forEach(value => html += `<option value="${value}">${value}</option>`);
                    html += `</select></div>`;
                    dynamicFiltersContainer.innerHTML += html;
                }
            });
        }
    });

    // Re-adiciona listeners para os inputs de ano recém-criados
    document.querySelectorAll('.dynamic-filter-year').forEach(input => {
        input.addEventListener('input', applyFilters);
    });
};

const applyFilters = () => {
    const selectedEntity = entityFilter.value;
    const activeFilters = {};
    const searchText = searchInput.value.toLowerCase().trim();
    
    // Captura anos
    const yearMinInput = document.getElementById('year-min')?.value;
    const yearMaxInput = document.getElementById('year-max')?.value;
    const yearMin = yearMinInput ? parseInt(yearMinInput) : 0;
    const yearMax = yearMaxInput ? parseInt(yearMaxInput) : 9999;

    document.querySelectorAll('.dynamic-filter').forEach(select => {
        if (select.value !== 'all') activeFilters[select.dataset.fieldName] = select.value;
    });

    filteredRecords = (fullData.heurist.records || []).filter(record => {
        const recType = record.rec_RecTypeName || "Outros";
        
        // 0. Esconde Relacionamentos
        if (recType === 'Record relationship') return false;

        // 1. Filtro de Entidade
        if (selectedEntity !== 'all' && recType !== selectedEntity) return false;
        
        // 2. Filtro de Ano (Lógica melhorada)
        // Só aplica se o usuário digitou algo
        if (yearMinInput || yearMaxInput) {
            const yearDetail = (record.details || []).find(d => d.fieldName === 'Ano(s) de produção');
            if (!yearDetail) return false; // Se não tem ano, sai
            
            let recYear = 0;
            // Verifica se o valor é um objeto complexo (ex: {start:..., end:...}) ou simples
            if (typeof yearDetail.value === 'object') {
                // Tenta pegar o ano mais antigo disponivel na estrutura
                const rawYear = yearDetail.value.start?.earliest || yearDetail.value.estMinDate || yearDetail.value;
                recYear = parseInt(rawYear);
            } else {
                recYear = parseInt(yearDetail.value);
            }

            if (isNaN(recYear) || recYear < yearMin || recYear > yearMax) return false;
        }

        // 3. Filtros Dropdown
        const passesDynamicFilters = Object.keys(activeFilters).every(fieldName => {
            const filterValue = activeFilters[fieldName];
            return (record.details || []).some(detail => {
                if (detail.fieldName === fieldName) {
                    let val = detail.termLabel || detail.value;
                    if (typeof val === 'object' && val?.title) val = val.title;
                    return String(val) === filterValue;
                }
                return false;
            });
        });
        if (!passesDynamicFilters) return false;
        
        // 4. Busca por Texto (GLOBAL - Inclui Transcrições)
        if (searchText.length > 0) {
            // Busca no Título
            if ((record.rec_Title || '').toLowerCase().includes(searchText)) return true;

            // Busca em TODOS os detalhes (transforma tudo em texto para varrer)
            const detailsMatch = (record.details || []).some(detail => {
                let val = detail.termLabel || detail.value;
                
                // Se for objeto (ex: geo), ignora ou converte
                if (typeof val === 'object') {
                    if (val?.title) val = val.title; // Link
                    else if (val?.geo) return false; // Geo não é texto
                    else val = JSON.stringify(val); // Outros objetos
                }
                
                return String(val || '').toLowerCase().includes(searchText);
            });
            
            if (!detailsMatch) return false;
        }

        return true;
    });

    renderResultsList(filteredRecords);
    updateMapMarkers(filteredRecords);
};

const renderResultsList = (records) => {
    recordsContainer.innerHTML = '';
    resultsCountSpan.textContent = records.length;
    
    if (records.length === 0) {
        recordsContainer.innerHTML = `<li style="padding:10px; opacity: 0.8;">Nenhum item encontrado.</li>`;
        return;
    }

    records.forEach(record => {
        const li = document.createElement('li');
        li.classList.add('document-item');
        li.dataset.recordId = record.rec_ID;
        let title = record.rec_Title ? record.rec_Title.replace(/\n/g, ' - ') : "Sem Título";
        const type = record.rec_RecTypeName || "Item";
        
        li.innerHTML = `<strong style="color:var(--color-accent);">[${type}]</strong> ${title}`;
        li.addEventListener('click', () => displayRecordDetails(record));
        recordsContainer.appendChild(li);
    });
};

// --- Exibição de Detalhes (Com Abas) ---
const displayRecordDetails = (record) => {
    document.querySelectorAll('.document-item').forEach(item => item.classList.remove('selected'));
    const activeItem = document.querySelector(`[data-record-id="${record.rec_ID}"]`);
    if(activeItem) activeItem.classList.add('selected');

    const title = record.rec_Title ? record.rec_Title.replace(/\n/g, '<br>') : "Sem Título";
    
    let summary = "";
    let transcriptions = {};
    let mainInfo = [];
    let peopleInfo = {};
    let links = [];

    (record.details || []).forEach(detail => {
        let label = detail.fieldName;
        let value = detail.termLabel || detail.value;
        
        if (typeof value === 'object' && value !== null && value.title) {
            value = value.title.replace(/\n/g, ' - ');
        }
        // Tratamento especial para datas complexas na visualização
        if (typeof value === 'object' && label === 'Ano(s) de produção') {
             value = value.start?.earliest || value.estMinDate || JSON.stringify(value);
        }

        value = String(value || 'N/A');

        if (label === 'Resumo do documento') {
            summary = value;
        } else if (label.includes('Transcrição')) {
            transcriptions[label] = value;
        } else if (['Link para acesso', 'URL', 'Cota'].includes(label)) {
            links.push({ label, value });
        } else if (['Denunciante', 'Denunciado(a)', 'Citado(a)', 'Autoridades', 'Testemunha', 'Apresentado(a)'].includes(label)) {
            if (!peopleInfo[label]) peopleInfo[label] = [];
            peopleInfo[label].push(value);
        } else if (!label.includes('Geolocalização') && label !== 'Código de imagem') {
            mainInfo.push({ label, value });
        }
    });

    let html = `<h2 style="color: var(--color-accent); border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">${title}</h2>`;
    
    html += `<div style="margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">`;
    mainInfo.forEach(info => {
        html += `<div><span class="detail-label">${info.label}</span><span class="detail-value">${info.value}</span></div>`;
    });
    html += `</div>`;

    if (Object.keys(peopleInfo).length > 0) {
        html += `<div style="margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px;">`;
        for (const [role, names] of Object.entries(peopleInfo)) {
            html += `<div class="detail-group"><span class="detail-label">${role}</span><ul class="person-list">`;
            names.forEach(name => { html += `<li>${name}</li>`; });
            html += `</ul></div>`;
        }
        html += `</div>`;
    }

    if (links.length > 0) {
        html += `<div style="margin-top: 20px; background: rgba(228, 214, 167, 0.05); padding: 15px; border-radius: 5px;">`;
        links.forEach(info => {
            let content = info.value;
            if (info.value.startsWith('http')) content = `<a href="${info.value}" target="_blank">Acessar Documento Externo &raquo;</a>`;
            html += `<div style="margin-bottom:5px;"><strong style="color:var(--color-gold)">${info.label}:</strong> ${content}</div>`;
        });
        html += `</div>`;
    }

    if (summary) {
        html += `<div style="margin-top: 25px;"><h3 style="color: var(--color-gold); border-left: 4px solid var(--color-accent); padding-left: 10px;">Resumo</h3><div style="background:rgba(0,0,0,0.2); padding:15px; border-radius:4px; margin-top:10px; line-height:1.6;">${summary}</div></div>`;
    }

    const transKeys = Object.keys(transcriptions);
    if (transKeys.length > 0) {
        html += `<div class="tabs-container"><div class="tabs-header">`;
        transKeys.forEach((key, index) => {
            const activeClass = index === 0 ? 'active' : '';
            const btnLabel = key.replace('Transcrição ', ''); 
            html += `<button class="tab-btn ${activeClass}" onclick="switchTab('${index}')">${btnLabel}</button>`;
        });
        html += `</div>`;

        transKeys.forEach((key, index) => {
            const activeClass = index === 0 ? 'active' : '';
            html += `<div id="tab-content-${index}" class="tab-content ${activeClass}">${transcriptions[key]}</div>`;
        });
        html += `</div>`;
    }

    detailContainer.innerHTML = html;
};

window.switchTab = (index) => {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.querySelectorAll('.tab-btn')[index].classList.add('active');
    document.getElementById(`tab-content-${index}`).classList.add('active');
};

const clearFilters = () => {
    entityFilter.value = 'all';
    generateDynamicFilters();
    searchInput.value = '';
    applyFilters();
};

const setupEventListeners = () => {
    entityFilter.addEventListener('change', () => { generateDynamicFilters(); applyFilters(); });
    searchInput.addEventListener('input', applyFilters);
    dynamicFiltersContainer.addEventListener('change', (e) => {
        if(e.target.classList.contains('dynamic-filter')) applyFilters();
    });
    document.getElementById('clear-filters-button').addEventListener('click', clearFilters);
};

initPage();