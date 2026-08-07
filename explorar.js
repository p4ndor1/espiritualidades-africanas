// explorar.js - Vínculos Dinâmicos e Nova Ordem de Filtros

let fullData = {};
let filteredRecords = [];
let map = null;
let markersCluster = null;

const recordsContainer = document.getElementById('result-list');
const detailContainer = document.getElementById('document-detail');
const dynamicFiltersContainer = document.getElementById('dynamic-filters');
const entityFilter = document.getElementById('entity-filter');
const searchInput = document.getElementById('search-text');
const resultsCountSpan = document.getElementById('results-count');

const initPage = () => {
    try {
        if (typeof dbData === 'undefined') throw new Error("Variável 'dbData' não encontrada.");
        fullData = dbData;
        
        setupEventListeners();
        initMap();
        populateEntityFilter();
        generateDynamicFilters();
        applyFilters();
    } catch (error) {
        recordsContainer.innerHTML = `<li style="color:var(--color-accent); padding:10px;">Erro: ${error.message}</li>`;
    }
};

const initMap = () => {
    map = L.map('map-placeholder').setView([20, 0], 3);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom: 19
    }).addTo(map);

    markersCluster = L.markerClusterGroup({
        iconCreateFunction: function(cluster) {
            const count = cluster.getChildCount();
            let size = Math.min(30 + (count / 10), 60);
            const html = `<div style="background-color: var(--color-accent); color: var(--color-white); border-radius: 50%; width:${size}px; height:${size}px; line-height:${size}px; text-align: center; font-weight: bold; border: 2px solid var(--color-dark); box-shadow: 0 2px 5px rgba(0,0,0,0.2);">${count}</div>`;
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
        const geoDetail = (record.details || []).find(d => d.fieldName.includes('Geolocalização'));
        if (geoDetail && geoDetail.value && geoDetail.value.geo && geoDetail.value.geo.wkt) {
            const coords = geoDetail.value.geo.wkt.match(/POINT\(\s*([-\d\.]+)\s+([-\d\.]+)\s*\)/);
            if (coords) {
                const lng = parseFloat(coords[1]); 
                const lat = parseFloat(coords[2]);
                const marker = L.marker([lat, lng]);
                let title = record.rec_Title ? record.rec_Title.replace(/\n/g, ' ') : "Item";
                
                marker.bindPopup(`
                    <strong style="color:var(--color-dark)">${title}</strong><br>
                    <button onclick="displayRecordDetailsFromMap('${record.rec_ID}')" 
                            style="margin-top:8px; padding:6px 12px; background:var(--color-accent); color:var(--color-white); border:none; border-radius:4px; cursor:pointer; width: 100%;">
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
    const record = fullData.heurist.records.find(r => String(r.rec_ID) === String(recID));
    if (record) {
        displayRecordDetails(record);
        document.getElementById('document-detail').scrollIntoView({ behavior: 'smooth' });
    }
};

const populateEntityFilter = () => {
    const records = fullData.heurist.records || [];
    const entityTypes = new Set();
    
    // Lista de lixos do Heurist que o site deve ignorar
    const ignoredTypes = ['Record relationship', 'CMS Menu-Page', 'CMS_Home', 'Person'];
    
    records.forEach(r => { 
        if (r.rec_RecTypeName && !ignoredTypes.includes(r.rec_RecTypeName)) {
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
            if (detail.fieldName === 'Ano(s) de produção') return;
            const isFilterable = ['enum', 'freetext', 'date'].includes(detail.fieldType) || !detail.fieldType;
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
    const entitiesProcess = selectedEntity === 'all' ? Object.keys(allFields) : [selectedEntity];

    // ORDEM EXATA DOS FILTROS COMO PEDIDO PELO PROFESSOR
    const requestedOrder = ['Papel', 'Tipo de prática'];

    // 1. Renderiza Papel e Tipo de Prática primeiro
    requestedOrder.forEach(fieldName => {
        let options = new Set();
        entitiesProcess.forEach(entity => {
            if (allFields[entity] && allFields[entity].has(fieldName)) {
                allFields[entity].get(fieldName).forEach(val => options.add(val));
            }
        });
        if (options.size > 0) {
            const values = Array.from(options).sort();
            let html = `<div class="filter-group"><label>${fieldName}:</label><select class="dynamic-filter" data-field-name="${fieldName}"><option value="all">Todos</option>`;
            values.forEach(value => html += `<option value="${value}">${value}</option>`);
            html += `</select></div>`;
            dynamicFiltersContainer.innerHTML += html;
        }
    });

    // 2. Renderiza o Ano (Intervalo) no meio
    dynamicFiltersContainer.innerHTML += `
        <div class="filter-group">
            <label>Ano (Intervalo):</label>
            <div style="display: flex; gap: 10px;">
                <input type="number" id="year-min" placeholder="De (ex: 1600)" class="dynamic-filter-year" style="width: 50%; padding:10px; background:var(--color-white); border:1px solid rgba(28,17,10,0.3); color:var(--color-dark); border-radius:4px;">
                <input type="number" id="year-max" placeholder="Até (ex: 1800)" class="dynamic-filter-year" style="width: 50%; padding:10px; background:var(--color-white); border:1px solid rgba(28,17,10,0.3); color:var(--color-dark); border-radius:4px;">
            </div>
        </div>
    `;

    // 3. Renderiza o Restante da Ordem
    const restOrder = ['Condição jurídica', 'Qualidade ou cor', 'Nação'];
    restOrder.forEach(fieldName => {
        let options = new Set();
        entitiesProcess.forEach(entity => {
            if (allFields[entity] && allFields[entity].has(fieldName)) {
                allFields[entity].get(fieldName).forEach(val => options.add(val));
            }
        });
        if (options.size > 0) {
            const values = Array.from(options).sort();
            let html = `<div class="filter-group"><label>${fieldName}:</label><select class="dynamic-filter" data-field-name="${fieldName}"><option value="all">Todos</option>`;
            values.forEach(value => html += `<option value="${value}">${value}</option>`);
            html += `</select></div>`;
            dynamicFiltersContainer.innerHTML += html;
        }
    });

    document.querySelectorAll('.dynamic-filter-year').forEach(input => {
        input.addEventListener('input', applyFilters);
    });

const applyFilters = () => {
    const selectedEntity = entityFilter.value;
    const activeFilters = {};
    const searchText = searchInput.value.toLowerCase().trim();
    
    const yearMinInput = document.getElementById('year-min')?.value;
    const yearMaxInput = document.getElementById('year-max')?.value;
    const yearMin = yearMinInput ? parseInt(yearMinInput) : 0;
    const yearMax = yearMaxInput ? parseInt(yearMaxInput) : 9999;

    document.querySelectorAll('.dynamic-filter').forEach(select => {
        if (select.value !== 'all') activeFilters[select.dataset.fieldName] = select.value;
    });

    filteredRecords = (fullData.heurist.records || []).filter(record => {
        const recType = record.rec_RecTypeName || "Outros";
        
        // Bloqueia o lixo do Heurist de aparecer na lista de resultados
        const ignoredTypes = ['Record relationship', 'CMS Menu-Page', 'CMS_Home', 'Person'];
        if (ignoredTypes.includes(recType)) return false;
        
        if (selectedEntity !== 'all' && recType !== selectedEntity) return false;

        if (yearMinInput || yearMaxInput) {
            const yearDetail = (record.details || []).find(d => d.fieldName === 'Ano(s) de produção');
            if (!yearDetail) return false; 
            
            let recYear = 0;
            if (typeof yearDetail.value === 'object') {
                const rawYear = yearDetail.value.start?.earliest || yearDetail.value.estMinDate || yearDetail.value;
                recYear = parseInt(rawYear);
            } else {
                recYear = parseInt(yearDetail.value);
            }
            if (isNaN(recYear) || recYear < yearMin || recYear > yearMax) return false;
        }

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
        
        if (searchText.length > 0) {
            if ((record.rec_Title || '').toLowerCase().includes(searchText)) return true;
            const detailsMatch = (record.details || []).some(detail => {
                let val = detail.termLabel || detail.value;
                if (typeof val === 'object') {
                    if (val?.title) val = val.title; 
                    else if (val?.geo) return false; 
                    else val = JSON.stringify(val); 
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
        recordsContainer.innerHTML = `<li style="padding:10px; opacity: 0.8; color: var(--color-dark);">Nenhum item encontrado.</li>`;
        return;
    }

    records.forEach(record => {
        const li = document.createElement('li');
        li.classList.add('document-item');
        li.dataset.recordId = record.rec_ID;
        let title = record.rec_Title ? record.rec_Title.replace(/\n/g, ' - ') : "Sem Título";
        const type = record.rec_RecTypeName || "Item";
        
        li.innerHTML = `<strong style="color:var(--color-accent);">[${type}]</strong> <span style="color:var(--color-dark);">${title}</span>`;
        li.addEventListener('click', () => displayRecordDetails(record));
        recordsContainer.appendChild(li);
    });
};

// --- Exibição de Detalhes com Links Dinâmicos (Pessoa <-> Documento) ---
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
        let linkedRecId = null;

        // Tenta capturar ID de relacionamento caso o campo seja um vínculo no Heurist
        if (typeof detail.value === 'object' && detail.value !== null) {
            if (detail.value.id) linkedRecId = detail.value.id;
            else if (detail.value.rec_ID) linkedRecId = detail.value.rec_ID;
        }

        if (typeof value === 'object' && value !== null && value.title) {
            value = value.title.replace(/\n/g, ' - ');
        }
        
        // Se não achou ID direto, tenta buscar na base pelo texto exato
        if (!linkedRecId && typeof value === 'string') {
            const possibleMatch = fullData.heurist.records.find(r => (r.rec_Title || '').replace(/\n/g, ' - ') === value);
            if (possibleMatch) linkedRecId = possibleMatch.rec_ID;
        }

        if (typeof value === 'object' && label === 'Ano(s) de produção') {
             value = value.start?.earliest || value.estMinDate || JSON.stringify(value);
        }

        value = String(value || 'N/A');

        // Cria a âncora clicável se existir um ID de vínculo
        let displayHTML = value;
        if (linkedRecId && linkedRecId !== record.rec_ID) {
            displayHTML = `<a href="javascript:void(0)" onclick="displayRecordDetailsFromMap('${linkedRecId}')" style="color: var(--color-accent); text-decoration: underline; font-weight: bold; cursor: pointer;">${value} &raquo;</a>`;
        }

        if (label === 'Resumo do documento') {
            summary = value;
        } else if (label.includes('Transcrição')) {
            transcriptions[label] = value;
        } else if (['Link para acesso', 'URL', 'Cota'].includes(label)) {
            links.push({ label, value });
        } else if (['Documento', 'Denunciante', 'Denunciado(a)', 'Citado(a)', 'Autoridades', 'Testemunha', 'Apresentado(a)'].includes(label)) {
            // Documento também entra aqui para pessoas listarem seus docs
            if (!peopleInfo[label]) peopleInfo[label] = [];
            peopleInfo[label].push(displayHTML);
        } else if (!label.includes('Geolocalização') && label !== 'Código de imagem') {
            mainInfo.push({ label, value: displayHTML });
        }
    });

    let html = `<h2 style="color: var(--color-accent); border-bottom: 1px solid rgba(28,17,10,0.2); padding-bottom: 10px;">${title}</h2>`;
    
    html += `<div style="margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">`;
    mainInfo.forEach(info => {
        html += `<div><span class="detail-label" style="color: var(--color-dark); font-weight: bold; display: block; margin-bottom: 3px;">${info.label}</span><span class="detail-value" style="color: var(--color-dark);">${info.value}</span></div>`;
    });
    html += `</div>`;

    if (Object.keys(peopleInfo).length > 0) {
        html += `<div style="margin-top: 20px; border-top: 1px solid rgba(28,17,10,0.2); padding-top: 15px;">`;
        for (const [role, items] of Object.entries(peopleInfo)) {
            html += `<div class="detail-group" style="margin-bottom: 15px;"><span class="detail-label" style="color: var(--color-dark); font-weight: bold; display: block; margin-bottom: 5px;">${role}</span><ul class="person-list" style="list-style: none; padding-left: 10px; border-left: 2px solid var(--color-accent);">`;
            items.forEach(item => { html += `<li style="color: var(--color-dark); margin-bottom: 5px;">${item}</li>`; });
            html += `</ul></div>`;
        }
        html += `</div>`;
    }

    if (links.length > 0) {
        html += `<div style="margin-top: 20px; background: rgba(228, 214, 167, 0.4); padding: 15px; border-radius: 5px; border: 1px solid rgba(28,17,10,0.1);">`;
        links.forEach(info => {
            let content = info.value;
            if (info.value.startsWith('http')) content = `<a href="${info.value}" target="_blank" style="color: var(--color-accent); text-decoration: underline;">Acessar Documento Externo &raquo;</a>`;
            html += `<div style="margin-bottom:5px;"><strong style="color:var(--color-dark)">${info.label}:</strong> <span style="color: var(--color-dark);">${content}</span></div>`;
        });
        html += `</div>`;
    }

    if (summary) {
        html += `<div style="margin-top: 25px;"><h3 style="color: var(--color-dark); border-left: 4px solid var(--color-accent); padding-left: 10px;">Resumo</h3><div style="background:rgba(255,255,255,0.5); padding:15px; border-radius:4px; margin-top:10px; line-height:1.6; color: var(--color-dark); border: 1px solid rgba(28,17,10,0.1);">${summary}</div></div>`;
    }

    const transKeys = Object.keys(transcriptions);
    if (transKeys.length > 0) {
        html += `<div class="tabs-container" style="border: 1px solid rgba(28,17,10,0.2);"><div class="tabs-header" style="background: rgba(28,17,10,0.05);">`;
        transKeys.forEach((key, index) => {
            const activeClass = index === 0 ? 'active' : '';
            const btnLabel = key.replace('Transcrição ', ''); 
            html += `<button class="tab-btn ${activeClass}" onclick="switchTab('${index}')" style="color: var(--color-dark); border-right: 1px solid rgba(28,17,10,0.1); padding: 15px; cursor: pointer; border-bottom: none; border-top: none; background: ${index === 0 ? 'var(--color-dark)' : 'transparent'}; color: ${index === 0 ? 'var(--color-gold)' : 'var(--color-dark)'};">${btnLabel}</button>`;
        });
        html += `</div>`;

        transKeys.forEach((key, index) => {
            const activeClass = index === 0 ? 'active' : '';
            html += `<div id="tab-content-${index}" class="tab-content ${activeClass}" style="background: var(--color-white); color: var(--color-dark); border-top: 1px solid rgba(28,17,10,0.2); padding: 20px; display: ${index === 0 ? 'block' : 'none'}; white-space: pre-wrap; max-height: 400px; overflow-y: auto;">${transcriptions[key]}</div>`;
        });
        html += `</div>`;
    }

    detailContainer.innerHTML = html;
};

window.switchTab = (index) => {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.style.backgroundColor = 'transparent';
        btn.style.color = 'var(--color-dark)';
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
        content.style.display = 'none';
    });
    
    const activeBtn = document.querySelectorAll('.tab-btn')[index];
    activeBtn.classList.add('active');
    activeBtn.style.backgroundColor = 'var(--color-dark)';
    activeBtn.style.color = 'var(--color-gold)';
    
    const activeContent = document.getElementById(`tab-content-${index}`);
    activeContent.classList.add('active');
    activeContent.style.display = 'block';
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