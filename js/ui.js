/* Интерфейс: ввод, чертежи, 3D, конструктор схем и обновление экрана. */
/***********************************************************************
 * 0. ТОЧНАЯ ЛИНЕЙНАЯ ШКАЛА ВНЕШНЕГО ДИАМЕТРА РУЛОНА (D)
 ***********************************************************************/
const DIAM_SLIDER_MIN = 100;
const DIAM_SLIDER_MAX = 800;
const DIAM_SCALE_TICKS = [
    { value: 100, label: '100 мм' },
    { value: 200, label: '200' },
    { value: 240, label: '240' },
    { value: 295, label: '295' },
    { value: 400, label: '400' },
    { value: 600, label: '600' },
    { value: 800, label: '800 мм' }
];

function buildDiameterScaleTicks() {
    const container = document.getElementById('diamScaleTicks');
    if (!container) return;

    const span = DIAM_SLIDER_MAX - DIAM_SLIDER_MIN;
    container.innerHTML = DIAM_SCALE_TICKS.map(tick => {
        const pct = Math.max(0, Math.min(100, ((tick.value - DIAM_SLIDER_MIN) / span) * 100));
        return `
            <div class="diam-tick-item" data-tick-value="${tick.value}" style="left: ${pct.toFixed(4)}%;"
                 onclick="setQuickDiam(${tick.value})" title="Установить диаметр ${tick.value} мм">
                <span class="diam-tick-mark"></span>
                <span class="diam-tick-label mono">${tick.label}</span>
            </div>
        `;
    }).join('');
}

function updateDiameterSliderVisual(currentDiam) {
    const slider = document.getElementById('sliderRollDiam');
    const ticksContainer = document.getElementById('diamScaleTicks');
    if (!slider) return;

    const clamped = Math.max(DIAM_SLIDER_MIN, Math.min(DIAM_SLIDER_MAX, currentDiam));
    const pct = ((clamped - DIAM_SLIDER_MIN) / (DIAM_SLIDER_MAX - DIAM_SLIDER_MIN)) * 100;

    slider.style.background = `linear-gradient(to right, #2563eb 0%, #2563eb ${pct.toFixed(3)}%, #cbd5e1 ${pct.toFixed(3)}%, #cbd5e1 100%)`;

    if (ticksContainer) {
        const items = ticksContainer.querySelectorAll('.diam-tick-item');
        items.forEach(item => {
            const tv = parseFloat(item.getAttribute('data-tick-value'));
            if (Math.abs(currentDiam - tv) <= 1.5) {
                item.classList.add('is-active');
            } else {
                item.classList.remove('is-active');
            }
        });
    }
}

/***********************************************************************
 * 2. ГЛОБАЛЬНОЕ СОСТОЯНИЕ ПРИЛОЖЕНИЯ
 ***********************************************************************/
const state = {
    rollDiam: 235,
    rollLength: 734.15,
    exactLockedLength: null,
    lockMode: 'length',
    coreInnerDiam: 76,
    coreWall: 8,
    coreDensity: 0.72,
    thicknessMicrons: 50,
    windingLayers: 1,
    rollWidth: 500,
    printStepMm: 250,
    printStreams: 1,
    density: 0.92,
    rollGap: 0,
    palletType: '1200x800',
    orientation: 'vertical',
    horizAxis: 'along_length',
    horizStackType: 'straight',
    tiers: 3,
    palletWoodWeight: 22,
    maxHeightLimitMm: 1800,
    maxWeightLimitKg: 1000,
    useInterlayer: true,
    interlayerThickMm: 4,
    interlayerWeightKg: 0.8,
    stretchWrapWeightKg: 1.5,
    packPrices: { pallet: 120, sheet: 3, stretch: 10, core: 1.1 },
    batchOrderValue: 3000,
    batchOrderUnit: 'kg',
    activeSchemeId: 'std_18',
    autoSelectScheme: true,
    schemeFilter: 'all',
    schemes: []
};

function calculateAll() {
    const d_inner = state.coreInnerDiam;
    const wall = state.coreWall > 0 ? state.coreWall : 0;
    const d_core = d_inner + 2 * wall;
    const D = state.rollDiam;
    const h_um = positiveOr(state.thicknessMicrons, 0);
    const layers = Math.max(1, state.windingLayers);
    const effective_h_um = h_um * layers;
    const B = positiveOr(state.rollWidth, 0);
    const rho = positiveOr(state.density, 0);
    const coreRho = positiveOr(state.coreDensity, 0);
    const gap = state.rollGap > 0 ? state.rollGap : 0;

    let lengthMeters = 0;
    let turnsCount = 0;
    if (state.exactLockedLength !== null && state.exactLockedLength > 0) {
        lengthMeters = state.exactLockedLength;
        turnsCount = effective_h_um > 0 ? Math.round(((D - d_core) / 2 * 1000) / effective_h_um) : 0;
    } else if (D > d_core && effective_h_um > 0) {
        lengthMeters = filmLengthMeters(D, d_core, effective_h_um);
        turnsCount = Math.round(((D - d_core) / 2 * 1000) / effective_h_um);
    }
    state.rollLength = lengthMeters;

    const areaSqM = lengthMeters * (B / 1000) * layers;
    const netWeightKg = (areaSqM * h_um * rho) / 1000;

    const coreCrossSectionMm2 = (Math.PI / 4) * (d_core * d_core - d_inner * d_inner);
    const coreVolumeCm3 = (coreCrossSectionMm2 * B) / 1000;
    const coreWeightKg = (coreVolumeCm3 * coreRho) / 1000;
    const grossWeightKg = netWeightKg + coreWeightKg;

    const structure = calculatePalletStructureForTiers(state.tiers, D, B, gap);
    const rollsPerTier = structure.rollsPerTier;
    const totalRollsOnPallet = structure.totalRollsOnPallet;
    const sheetsPerPallet = structure.sheetsPerPallet;
    const totalHeightMm = structure.totalHeightMm;

    const packagingAddWeightKg = state.useInterlayer
        ? (sheetsPerPallet * state.interlayerWeightKg + state.stretchWrapWeightKg)
        : 0;

    const totalPalletArea = areaSqM * totalRollsOnPallet;
    const totalPalletLength = lengthMeters * totalRollsOnPallet;
    const totalPalletNetWeight = netWeightKg * totalRollsOnPallet;
    const totalTareWeight = coreWeightKg * totalRollsOnPallet + state.palletWoodWeight + packagingAddWeightKg;
    const totalPalletGrossWeight = totalPalletNetWeight + totalTareWeight;

    const impPerRoll = calculateImpressions(lengthMeters, state.printStepMm, state.printStreams);
    const totalPalletImpressionsWhole = impPerRoll.wholeCount * totalRollsOnPallet;
    const totalPalletImpressionsExact = impPerRoll.exactCount * totalRollsOnPallet;

    return {
        D: Math.round(D * 10) / 10,
        d_inner,
        d_core,
        h_um,
        layers,
        effective_h_um,
        B,
        rho,
        lengthMeters,
        turnsCount,
        areaSqM,
        netWeightKg,
        coreWeightKg,
        grossWeightKg,
        rollsPerTier,
        totalRollsOnPallet,
        sheetsPerPallet,
        maxPyramidTiers: structure.maxPyramidTiers,
        packagingAddWeightKg,
        totalHeightMm,
        totalPalletArea,
        totalPalletLength,
        totalPalletNetWeight,
        totalTareWeight,
        totalPalletGrossWeight,
        impPerRoll,
        totalPalletImpressionsWhole,
        totalPalletImpressionsExact
    };
}

/***********************************************************************
 * 4. ОТРИСОВКА 2D-ЧЕРТЕЖА ВИДА СВЕРХУ
 ***********************************************************************/
function drawTopViewCanvas(calc) {
    const canvas = document.getElementById('canvasTopView');
    if (!canvas) return;
    const parent = canvas.parentElement;
    const cw = parent.clientWidth || 480;
    const ch = parent.clientHeight || 320;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';

    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cw, ch);

    const palletDim = PALLET_DIMENSIONS[state.palletType];
    const pad = 34;
    const scale = Math.min((cw - pad * 2) / palletDim.w, (ch - pad * 2) / palletDim.h);
    const pw = palletDim.w * scale;
    const ph = palletDim.h * scale;
    const ox = (cw - pw) / 2;
    const oy = (ch - ph) / 2;

    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 2.5;
    ctx.fillRect(ox, oy, pw, ph);
    ctx.strokeRect(ox, oy, pw, ph);

    ctx.fillStyle = 'rgba(203, 213, 225, 0.28)';
    const boards = 5;
    const boardH = ph / (boards * 2 - 1);
    for (let i = 0; i < boards; i++) {
        ctx.fillRect(ox + 2, oy + i * 2 * boardH, pw - 4, boardH);
    }

    ctx.fillStyle = '#475569';
    ctx.font = '600 11px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${palletDim.w} мм`, ox + pw / 2, oy - 10);

    ctx.save();
    ctx.translate(ox - 12, oy + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${palletDim.h} мм`, 0, 0);
    ctx.restore();

    let hasOverhang = false;
    let hasOverlap = false;
    let maxOverlapMm = 0;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let occupiedAreaMm2 = 0;

    if (state.orientation === 'vertical') {
        const scheme = state.schemes.find(s => s.id === state.activeSchemeId) || state.schemes[0];
        const pts = getActualRollPositionsMm(scheme, palletDim.w, palletDim.h, calc.D, state.rollGap);
        const rMm = calc.D / 2;
        const rPx = rMm * scale;
        const coreRPx = (calc.d_core / 2) * scale;

        const overlappingIndices = new Set();
        const overlapPairs = [];
        for (let i = 0; i < pts.length; i++) {
            for (let j = i + 1; j < pts.length; j++) {
                const dist = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
                const overlap = calc.D - dist;
                if (overlap > 1.5) {
                    hasOverlap = true;
                    overlappingIndices.add(i);
                    overlappingIndices.add(j);
                    if (overlap > maxOverlapMm) maxOverlapMm = overlap;
                    overlapPairs.push({ i, j });
                }
            }
        }

        pts.forEach((pt, idx) => {
            const left = pt.x - rMm;
            const right = pt.x + rMm;
            const top = pt.y - rMm;
            const bottom = pt.y + rMm;

            if (left < minX) minX = left;
            if (right > maxX) maxX = right;
            if (top < minY) minY = top;
            if (bottom > maxY) maxY = bottom;

            const isOut = (left < -2 || right > palletDim.w + 2 || top < -2 || bottom > palletDim.h + 2);
            if (isOut) hasOverhang = true;
            const isColliding = overlappingIndices.has(idx);

            const cx = ox + pt.x * scale;
            const cy = oy + pt.y * scale;

            ctx.beginPath();
            ctx.arc(cx, cy, Math.max(2, rPx), 0, Math.PI * 2);
            if (isColliding) {
                ctx.fillStyle = 'rgba(225, 29, 72, 0.86)';
                ctx.strokeStyle = '#881337';
            } else if (isOut) {
                ctx.fillStyle = 'rgba(245, 158, 11, 0.85)';
                ctx.strokeStyle = '#b45309';
            } else {
                ctx.fillStyle = '#3b6fc4';
                ctx.strokeStyle = '#1e3a8a';
            }
            ctx.fill();
            ctx.lineWidth = isColliding ? 2.2 : 1.5;
            ctx.stroke();

            if (coreRPx > 2.5) {
                ctx.beginPath();
                ctx.arc(cx, cy, coreRPx, 0, Math.PI * 2);
                ctx.fillStyle = '#e2e8f0';
                ctx.fill();
                ctx.lineWidth = 1;
                ctx.strokeStyle = '#475569';
                ctx.stroke();
            }

            if (rPx > 14) {
                ctx.fillStyle = '#ffffff';
                ctx.font = '700 10px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(idx + 1, cx, cy - (coreRPx > 4 ? coreRPx + (rPx - coreRPx) / 2 : 0));
            }
        });

        overlapPairs.forEach(pair => {
            const p1 = pts[pair.i];
            const p2 = pts[pair.j];
            ctx.save();
            ctx.strokeStyle = '#fecdd3';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(ox + p1.x * scale, oy + p1.y * scale);
            ctx.lineTo(ox + p2.x * scale, oy + p2.y * scale);
            ctx.stroke();
            ctx.restore();
        });

        occupiedAreaMm2 = pts.length * Math.PI * rMm * rMm;

        const effectiveD = calc.D + state.rollGap;
        const exceedsSchemeMax = scheme && effectiveD > scheme.maxDiam && hasOverhang;
        const banner = document.getElementById('overhangWarningBanner');
        const bannerText = document.getElementById('overhangWarningText');

        if (hasOverlap || hasOverhang || exceedsSchemeMax) {
            banner.classList.remove('hidden');
            const overhangX = Math.max(0, Math.round((maxX - minX) - palletDim.w));
            const overhangY = Math.max(0, Math.round((maxY - minY) - palletDim.h));
            if (hasOverlap) {
                bannerText.textContent = `Внимание: рулоны наезжают друг на друга (нахлест до ${Math.round(maxOverlapMm)} мм)! Уменьшите диаметр или измените расстановку.`;
            } else {
                const gapInfo = state.rollGap > 0 ? ` + зазор ${state.rollGap} мм = шаг ${effectiveD} мм` : '';
                bannerText.textContent = `Внимание: рулоны выступают за края паллеты (Ø ${calc.D} мм${gapInfo}). Свес за края паллеты: ~${Math.max(1, overhangX, overhangY)} мм.`;
            }
        } else {
            banner.classList.add('hidden');
        }
    } else {
        const horiz = calculateHorizontalLayout(palletDim.w, palletDim.h, calc.D, state.rollWidth, state.horizAxis, state.rollGap);
        const banner = document.getElementById('overhangWarningBanner');
        const bannerText = document.getElementById('overhangWarningText');

        horiz.rects.forEach((rc, idx) => {
            const left = rc.x - rc.w / 2;
            const right = rc.x + rc.w / 2;
            const top = rc.y - rc.h / 2;
            const bottom = rc.y + rc.h / 2;
            if (left < minX) minX = left;
            if (right > maxX) maxX = right;
            if (top < minY) minY = top;
            if (bottom > maxY) maxY = bottom;

            const isOut = (left < -2 || right > palletDim.w + 2 || top < -2 || bottom > palletDim.h + 2);
            if (isOut) hasOverhang = true;

            const rx = ox + left * scale;
            const ry = oy + top * scale;
            const rw = rc.w * scale;
            const rh = rc.h * scale;

            ctx.fillStyle = isOut ? 'rgba(245, 158, 11, 0.85)' : '#3b6fc4';
            ctx.strokeStyle = isOut ? '#b45309' : '#1e3a8a';
            ctx.lineWidth = 1.5;
            ctx.fillRect(rx + 1, ry + 1, Math.max(2, rw - 2), Math.max(2, rh - 2));
            ctx.strokeRect(rx + 1, ry + 1, Math.max(2, rw - 2), Math.max(2, rh - 2));

            ctx.fillStyle = '#ffffff';
            ctx.font = '600 10px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            if (rw > 24 && rh > 16) {
                ctx.fillText(`#${idx + 1}`, rx + rw / 2, ry + rh / 2);
            }
        });

        if (hasOverhang) {
            banner.classList.remove('hidden');
            const overhangX = Math.max(0, Math.round((maxX - minX) - palletDim.w));
            const overhangY = Math.max(0, Math.round((maxY - minY) - palletDim.h));
            bannerText.textContent = `Внимание: при горизонтальной укладке габарит рулона выступает за края паллеты на ~${Math.max(1, overhangX, overhangY)} мм.`;
        } else {
            banner.classList.add('hidden');
        }

        occupiedAreaMm2 = horiz.rects.length * calc.D * state.rollWidth;
    }

    ctx.restore();

    const palletAreaMm2 = palletDim.w * palletDim.h;
    const fillPct = Math.min(100, (occupiedAreaMm2 / palletAreaMm2) * 100);
    document.getElementById('lblPackingDensity').textContent = `Заполнение площади: ${fillPct.toFixed(1)}%`;

    const boxW = isFinite(minX) ? Math.round(maxX - minX) : 0;
    const boxH = isFinite(minY) ? Math.round(maxY - minY) : 0;
    document.getElementById('detBoundingBox').textContent = `${boxW} × ${boxH} мм`;
}

/***********************************************************************
 * 4B. ИНТЕРАКТИВНАЯ 3D-МОДЕЛЬ ПАЛЛЕТЫ С РУЛОНАМИ (THREE.JS)
 ***********************************************************************/
let threeCtx = {
    initialized: false,
    scene: null,
    camera: null,
    renderer: null,
    palletGroup: null,
    isDragging: false,
    prevX: 0,
    prevY: 0,
    theta: Math.PI / 4,
    phi: Math.PI / 3.1,
    radius: 2300,
    targetY: 500
};

function init3DViewer() {
    if (threeCtx.initialized || typeof THREE === 'undefined') return;
    const container = document.getElementById('container3DView');
    if (!container) return;

    const w = container.clientWidth || 320;
    const h = container.clientHeight || 230;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, w / h, 10, 15000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.72));
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.65);
    dirLight1.position.set(1800, 3200, 2200);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x93c5fd, 0.3);
    dirLight2.position.set(-1800, 1200, -1600);
    scene.add(dirLight2);

    const palletGroup = new THREE.Group();
    scene.add(palletGroup);

    const gridHelper = new THREE.GridHelper(2400, 12, 0xcbd5e1, 0xe2e8f0);
    gridHelper.position.y = -2;
    scene.add(gridHelper);

    threeCtx.scene = scene;
    threeCtx.camera = camera;
    threeCtx.renderer = renderer;
    threeCtx.palletGroup = palletGroup;
    threeCtx.initialized = true;

    const domEl = renderer.domElement;

    domEl.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        threeCtx.isDragging = true;
        threeCtx.prevX = e.clientX;
        threeCtx.prevY = e.clientY;
    });

    window.addEventListener('mousemove', (e) => {
        if (!threeCtx.isDragging) return;
        const dx = e.clientX - threeCtx.prevX;
        const dy = e.clientY - threeCtx.prevY;
        threeCtx.prevX = e.clientX;
        threeCtx.prevY = e.clientY;

        threeCtx.theta -= dx * 0.011;
        threeCtx.phi = Math.max(0.08, Math.min(Math.PI / 2 - 0.02, threeCtx.phi - dy * 0.011));
        update3DCameraPosition();
        render3DScene();
    });

    window.addEventListener('mouseup', () => {
        threeCtx.isDragging = false;
    });

    domEl.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            threeCtx.isDragging = true;
            threeCtx.prevX = e.touches[0].clientX;
            threeCtx.prevY = e.touches[0].clientY;
        }
    }, { passive: true });

    domEl.addEventListener('touchmove', (e) => {
        if (!threeCtx.isDragging || e.touches.length !== 1) return;
        const dx = e.touches[0].clientX - threeCtx.prevX;
        const dy = e.touches[0].clientY - threeCtx.prevY;
        threeCtx.prevX = e.touches[0].clientX;
        threeCtx.prevY = e.touches[0].clientY;

        threeCtx.theta -= dx * 0.012;
        threeCtx.phi = Math.max(0.08, Math.min(Math.PI / 2 - 0.02, threeCtx.phi - dy * 0.012));
        update3DCameraPosition();
        render3DScene();
    }, { passive: true });

    domEl.addEventListener('touchend', () => {
        threeCtx.isDragging = false;
    });

    domEl.addEventListener('wheel', (e) => {
        e.preventDefault();
        threeCtx.radius = Math.max(900, Math.min(6000, threeCtx.radius + e.deltaY * 1.4));
        update3DCameraPosition();
        render3DScene();
    }, { passive: false });

    update3DCameraPosition();
}

function update3DCameraPosition() {
    if (!threeCtx.initialized) return;
    const { camera, radius, theta, phi, targetY } = threeCtx;
    camera.position.x = radius * Math.sin(phi) * Math.sin(theta);
    camera.position.y = targetY + radius * Math.cos(phi);
    camera.position.z = radius * Math.sin(phi) * Math.cos(theta);
    camera.lookAt(0, targetY * 0.85, 0);
}

function set3DCameraPreset(preset) {
    if (!threeCtx.initialized) return;
    if (preset === 'iso') {
        threeCtx.theta = Math.PI / 4;
        threeCtx.phi = Math.PI / 3.1;
    } else if (preset === 'front') {
        threeCtx.theta = 0;
        threeCtx.phi = Math.PI / 2.15;
    } else if (preset === 'side') {
        threeCtx.theta = Math.PI / 2;
        threeCtx.phi = Math.PI / 2.15;
    } else if (preset === 'top') {
        threeCtx.theta = 0;
        threeCtx.phi = 0.09;
    }
    update3DCameraPosition();
    render3DScene();
}

function render3DScene() {
    if (!threeCtx.initialized) return;
    threeCtx.renderer.render(threeCtx.scene, threeCtx.camera);
}

function create3DRollMesh(outerDiam, coreDiam, rollLength, isOverhang, tierIdx) {
    const group = new THREE.Group();
    const rOuter = Math.max(20, outerDiam / 2);
    const rCore = Math.min(rOuter - 4, Math.max(10, coreDiam / 2));

    const bodyGeo = new THREE.CylinderGeometry(rOuter, rOuter, rollLength, 32);
    const baseColor = isOverhang
        ? 0xf59e0b
        : (tierIdx % 2 === 0 ? 0x3b6fc4 : 0x2563eb);
    const bodyMat = new THREE.MeshLambertMaterial({ color: baseColor });
    group.add(new THREE.Mesh(bodyGeo, bodyMat));

    const coreGeo = new THREE.CylinderGeometry(rCore, rCore, rollLength + 3, 24);
    const coreMat = new THREE.MeshLambertMaterial({ color: 0xe2e8f0 });
    group.add(new THREE.Mesh(coreGeo, coreMat));

    const holeGeo = new THREE.CylinderGeometry(rCore * 0.78, rCore * 0.78, rollLength + 5, 20);
    const holeMat = new THREE.MeshBasicMaterial({ color: 0x334155 });
    group.add(new THREE.Mesh(holeGeo, holeMat));

    const edgesGeo = new THREE.EdgesGeometry(bodyGeo, 25);
    const edgesMat = new THREE.LineBasicMaterial({
        color: isOverhang ? 0x92400e : 0x1e3a8a,
        transparent: true,
        opacity: 0.55
    });
    group.add(new THREE.LineSegments(edgesGeo, edgesMat));

    return group;
}

function disposeObject3D(obj) {
    if (!obj) return;
    if (obj.children && obj.children.length > 0) {
        for (let i = obj.children.length - 1; i >= 0; i--) {
            disposeObject3D(obj.children[i]);
        }
    }
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
        if (Array.isArray(obj.material)) {
            obj.material.forEach(m => m && m.dispose && m.dispose());
        } else if (obj.material.dispose) {
            obj.material.dispose();
        }
    }
}

function drawSideViewCanvas(calc) {
    init3DViewer();
    if (!threeCtx.initialized) return;

    const container = document.getElementById('container3DView');
    if (container) {
        const cw = container.clientWidth || 320;
        const ch = container.clientHeight || 230;
        threeCtx.renderer.setSize(cw, ch);
        threeCtx.camera.aspect = cw / ch;
        threeCtx.camera.updateProjectionMatrix();
    }

    const group = threeCtx.palletGroup;
    while (group.children.length > 0) {
        const child = group.children[0];
        group.remove(child);
        disposeObject3D(child);
    }

    const palletDim = PALLET_DIMENSIONS[state.palletType];
    const pW = palletDim.w;
    const pH = palletDim.h;
    const palletWoodH = 145;

    const woodMat = new THREE.MeshLambertMaterial({ color: 0xd97706 });
    const woodDarkMat = new THREE.MeshLambertMaterial({ color: 0xb45309 });
    const woodEdgeMat = new THREE.LineBasicMaterial({ color: 0x78350f, transparent: true, opacity: 0.4 });

    const topBoardH = 22;
    const numBoards = 5;
    const boardDepth = (pH * 0.72) / numBoards;
    const boardStep = (pH - boardDepth) / (numBoards - 1);
    for (let i = 0; i < numBoards; i++) {
        const zPos = -pH / 2 + boardDepth / 2 + i * boardStep;
        const bGeo = new THREE.BoxGeometry(pW, topBoardH, boardDepth);
        const bMesh = new THREE.Mesh(bGeo, woodMat);
        bMesh.position.set(0, palletWoodH - topBoardH / 2, zPos);
        group.add(bMesh);

        const bEdges = new THREE.LineSegments(new THREE.EdgesGeometry(bGeo), woodEdgeMat);
        bEdges.position.copy(bMesh.position);
        group.add(bEdges);
    }

    const blockH = palletWoodH - topBoardH;
    const skiPositionsZ = [-pH / 2 + 50, 0, pH / 2 - 50];
    skiPositionsZ.forEach(zPos => {
        const skiGeo = new THREE.BoxGeometry(pW, blockH, 90);
        const skiMesh = new THREE.Mesh(skiGeo, woodDarkMat);
        skiMesh.position.set(0, blockH / 2, zPos);
        group.add(skiMesh);
    });

    if (state.orientation === 'vertical') {
        const scheme = state.schemes.find(s => s.id === state.activeSchemeId) || state.schemes[0];
        const pts = getActualRollPositionsMm(scheme, pW, pH, calc.D, state.rollGap);
        const rMm = calc.D / 2;
        const rollH = state.rollWidth;
        const sheetH = state.useInterlayer ? Math.max(0, state.interlayerThickMm) : 0;
        const sheetMat = new THREE.MeshLambertMaterial({ color: 0xc29b61 });

        for (let t = 0; t < state.tiers; t++) {
            const sheetCenterY = palletWoodH + t * (rollH + sheetH) + sheetH / 2;
            if (sheetH > 0) {
                const sGeo = new THREE.BoxGeometry(pW - 10, Math.max(3, sheetH), pH - 10);
                const sMesh = new THREE.Mesh(sGeo, sheetMat);
                sMesh.position.set(0, sheetCenterY, 0);
                group.add(sMesh);
            }

            const centerY = palletWoodH + t * (rollH + sheetH) + sheetH + rollH / 2;

            pts.forEach((pt) => {
                const isOut = (
                    pt.x - rMm < -2.5 ||
                    pt.x + rMm > pW + 2.5 ||
                    pt.y - rMm < -2.5 ||
                    pt.y + rMm > pH + 2.5
                );

                const rollMesh = create3DRollMesh(calc.D, calc.d_core, rollH, isOut, t);
                rollMesh.position.set(pt.x - pW / 2, centerY, pt.y - pH / 2);
                group.add(rollMesh);
            });
        }
    } else {
        const horiz = calculateHorizontalLayout(pW, pH, calc.D, state.rollWidth, state.horizAxis, state.rollGap);
        const rMm = calc.D / 2;
        const rollLen = state.rollWidth;
        const g = Math.max(0, state.rollGap);
        const isAlongLength = (state.horizAxis === 'along_length');
        const isPyramid = (state.horizStackType === 'pyramid');
        const sheetH = state.useInterlayer ? Math.max(0, state.interlayerThickMm) : 0;
        const sheetMat = new THREE.MeshLambertMaterial({ color: 0xc29b61 });

        const axialCount = isAlongLength ? horiz.cols : horiz.rows;
        const baseDiamCount = isAlongLength ? horiz.rows : horiz.cols;
        const effectiveTiers = isPyramid ? Math.min(state.tiers, baseDiamCount) : state.tiers;

        const totalAxialSpan = axialCount * rollLen + (axialCount - 1) * g;
        const startAxial = -totalAxialSpan / 2 + rollLen / 2;

        const pitchDiam = calc.D + g;
        const totalBaseDiamSpan = baseDiamCount * calc.D + (baseDiamCount - 1) * g;
        const startBaseDiam = -totalBaseDiamSpan / 2 + rMm;

        if (isPyramid && sheetH > 0) {
            const sGeo = new THREE.BoxGeometry(pW - 10, Math.max(3, sheetH), pH - 10);
            const sMesh = new THREE.Mesh(sGeo, sheetMat);
            sMesh.position.set(0, palletWoodH + sheetH / 2, 0);
            group.add(sMesh);
        }

        for (let t = 0; t < effectiveTiers; t++) {
            const countAlongD = isPyramid ? Math.max(0, baseDiamCount - t) : baseDiamCount;
            if (countAlongD <= 0) break;

            if (!isPyramid && sheetH > 0) {
                const sheetCenterY = palletWoodH + t * (calc.D + sheetH) + sheetH / 2;
                const sGeo = new THREE.BoxGeometry(pW - 10, Math.max(3, sheetH), pH - 10);
                const sMesh = new THREE.Mesh(sGeo, sheetMat);
                sMesh.position.set(0, sheetCenterY, 0);
                group.add(sMesh);
            }

            const rowShiftD = isPyramid ? t * (pitchDiam / 2) : 0;
            const centerY = isPyramid
                ? palletWoodH + sheetH + rMm + t * (calc.D * (Math.sqrt(3) / 2))
                : palletWoodH + t * (calc.D + sheetH) + sheetH + rMm;

            for (let dIdx = 0; dIdx < countAlongD; dIdx++) {
                const posDiam = startBaseDiam + rowShiftD + dIdx * pitchDiam;

                for (let aIdx = 0; aIdx < axialCount; aIdx++) {
                    const posAxial = startAxial + aIdx * (rollLen + g);
                    const xPos = isAlongLength ? posAxial : posDiam;
                    const zPos = isAlongLength ? posDiam : posAxial;
                    const halfSpanX = isAlongLength ? rollLen / 2 : rMm;
                    const halfSpanZ = isAlongLength ? rMm : rollLen / 2;
                    const isOut = (
                        xPos - halfSpanX < -pW / 2 - 2.5 ||
                        xPos + halfSpanX > pW / 2 + 2.5 ||
                        zPos - halfSpanZ < -pH / 2 - 2.5 ||
                        zPos + halfSpanZ > pH / 2 + 2.5
                    );

                    const rollMesh = create3DRollMesh(calc.D, calc.d_core, rollLen, isOut, t);

                    if (isAlongLength) {
                        rollMesh.rotation.z = Math.PI / 2;
                        rollMesh.position.set(xPos, centerY, zPos);
                    } else {
                        rollMesh.rotation.x = Math.PI / 2;
                        rollMesh.position.set(xPos, centerY, zPos);
                    }
                    group.add(rollMesh);
                }
            }
        }
    }

    threeCtx.targetY = Math.min(1400, Math.max(280, calc.totalHeightMm * 0.45));
    const recommendedRadius = Math.max(2200, calc.totalHeightMm * 1.45, Math.max(pW, pH) * 1.85);
    if (!threeCtx.isDragging) {
        threeCtx.radius = Math.min(5000, recommendedRadius);
    }
    update3DCameraPosition();
    render3DScene();
}

function generateSchemeCardSVG(scheme) {
    const refPallet = PALLET_DIMENSIONS[scheme.pallet || '1200x800'] || { w: 1200, h: 800 };
    const vw = 210;
    const vh = 140;
    const pad = 10;
    const scale = Math.min((vw - pad * 2) / refPallet.w, (vh - pad * 2) / refPallet.h);
    const pw = refPallet.w * scale;
    const ph = refPallet.h * scale;
    const ox = (vw - pw) / 2;
    const oy = (vh - ph) / 2;
    const rPx = (scheme.maxDiam / 2) * scale;

    const circlesSvg = scheme.points.map(pt => {
        const cx = (ox + pt.nx * pw).toFixed(1);
        const cy = (oy + pt.ny * ph).toFixed(1);
        return `<circle cx="${cx}" cy="${cy}" r="${Math.max(4, rPx - 0.6).toFixed(1)}" fill="#4472c4" stroke="#2f5597" stroke-width="1.2" />`;
    }).join('');

    return `
        <svg viewBox="0 0 ${vw} ${vh}" class="w-full h-28 mx-auto block">
            <rect x="${ox.toFixed(1)}" y="${oy.toFixed(1)}" width="${pw.toFixed(1)}" height="${ph.toFixed(1)}"
                  fill="#ffffff" stroke="#1f4e79" stroke-width="2.2" />
            ${circlesSvg}
        </svg>
    `;
}

function renderSchemeCards() {
    const container = document.getElementById('schemesGridContainer');
    if (!container) return;

    const palletDim = PALLET_DIMENSIONS[state.palletType];
    const filtered = state.schemes.filter(s => {
        if (state.schemeFilter === 'standard') return s.isStandard;
        if (state.schemeFilter === 'custom') return s.isCustom || !s.isStandard;
        return true;
    });

    container.innerHTML = filtered.map(scheme => {
        const isActive = (state.orientation === 'vertical' && state.activeSchemeId === scheme.id);
        const isFit = doesSchemeFitPallet(scheme, palletDim.w, palletDim.h, state.rollDiam, state.rollGap);

        return `
            <div onclick="manualSelectScheme('${scheme.id}')"
                 class="scheme-card cursor-pointer rounded-xl border-2 p-3 flex flex-col justify-between bg-white relative ${isActive ? 'active' : 'border-slate-200 hover:border-blue-300'}">
                ${scheme.isCustom ? `
                    <button type="button" onclick="deleteCustomScheme(event, '${scheme.id}')"
                            title="Удалить схему"
                            class="absolute top-2 right-2 w-6 h-6 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center text-xs font-bold">
                        ×
                    </button>
                ` : ''}
                <div class="text-center mb-1.5">
                    <div class="text-xs text-slate-700 font-medium leading-tight">
                        Диаметр до <strong class="font-extrabold text-slate-900">${scheme.maxDiam} мм</strong>
                    </div>
                    <div class="text-xs font-extrabold text-slate-900 leading-tight mt-0.5">
                        ${scheme.points.length} ${pluralizeRolls(scheme.points.length)} <span class="font-normal text-slate-600">${scheme.shifted ? 'со смещением' : 'без смещения'}</span>
                    </div>
                </div>

                <div class="my-1 bg-slate-50/70 rounded-lg py-1">
                    ${generateSchemeCardSVG(scheme)}
                </div>

                <div class="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span class="mono font-medium text-slate-500">${scheme.pallet || '1200×800'}</span>
                    <span class="px-1.5 py-0.5 rounded font-semibold ${isFit ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}">
                        ${isFit ? 'Подходит по Ø' : `Макс ${scheme.maxDiam} мм`}
                    </span>
                </div>
            </div>
        `;
    }).join('');
}

function pluralizeRolls(n) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'рулон';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'рулона';
    return 'рулонов';
}

/***********************************************************************
 * 5. ОБНОВЛЕНИЕ ИНТЕРФЕЙСА И АВТОПОДБОР СХЕМЫ
 ***********************************************************************/
function autoSelectBestScheme() {
    const palletDim = PALLET_DIMENSIONS[state.palletType];
    const effectiveD = state.rollDiam + Math.max(0, state.rollGap);

    let fittingCandidates = state.schemes.filter(s =>
        doesSchemeFitPallet(s, palletDim.w, palletDim.h, state.rollDiam, state.rollGap)
    );

    if (fittingCandidates.length) {
        fittingCandidates.sort((a, b) => {
            if (b.points.length !== a.points.length) return b.points.length - a.points.length;
            const aSamePallet = (a.pallet === state.palletType) ? 1 : 0;
            const bSamePallet = (b.pallet === state.palletType) ? 1 : 0;
            if (bSamePallet !== aSamePallet) return bSamePallet - aSamePallet;
            return a.maxDiam - b.maxDiam;
        });
        state.activeSchemeId = fittingCandidates[0].id;
    } else {
        let byDiam = state.schemes.filter(s => s.maxDiam >= effectiveD);
        if (byDiam.length) {
            byDiam.sort((a, b) => b.points.length - a.points.length || a.maxDiam - b.maxDiam);
            state.activeSchemeId = byDiam[0].id;
        } else {
            const sortedByMax = [...state.schemes].sort((a, b) => b.maxDiam - a.maxDiam);
            if (sortedByMax.length) state.activeSchemeId = sortedByMax[0].id;
        }
    }

    state.autoSelectScheme = true;
    const chk = document.getElementById('chkAutoScheme');
    if (chk) chk.checked = true;
}

function triggerOptimalScheme() {
    if (state.orientation !== 'vertical') {
        selectOrientation('vertical');
    }
    autoSelectBestScheme();
    updateUI();
}

function autoFitTiersToLimits() {
    const calc = calculateAll();
    const bestTiers = computeMaxAllowedTiers(calc);
    state.tiers = bestTiers;
    document.getElementById('inputTiers').value = bestTiers;
    updateUI();
}

function renderPiecesInRoll(lengthMeters) {
    const el = document.getElementById('resPiecesInRoll');
    if (!el) return;
    const text = piecesLine(lengthMeters, state.printStepMm, state.printStreams);
    el.textContent = text;
    el.hidden = !text;
}

function updateBatchCalculationUI(calc) {
    const batch = computeBatch(calc);
    const totalRollsNeeded = batch.totalRollsNeeded;
    const rollsPerPallet = batch.rollsPerPallet;
    const totalPallets = batch.totalPallets;
    const fullPallets = batch.fullPallets;
    const remainderRolls = batch.remainderRolls;

    document.getElementById('batchActualNetKg').textContent = `${batch.actualNetKg.toFixed(1)} кг нетто (${Math.round(batch.actualLengthM * calc.layers * (state.rollWidth / 1000)).toLocaleString('ru-RU')} м²)`;
    document.getElementById('batchTotalRolls').textContent = totalRollsNeeded.toLocaleString('ru-RU');
    document.getElementById('batchTotalLengthSub').textContent = `${Math.round(batch.actualLengthM).toLocaleString('ru-RU')} пог. м`;

    document.getElementById('batchTotalPallets').textContent = totalPallets.toLocaleString('ru-RU');
    if (remainderRolls > 0 && fullPallets > 0) {
        document.getElementById('batchFullPalletsBreakdown').textContent = `${fullPallets} полн. + 1 неполн.`;
    } else if (remainderRolls > 0 && fullPallets === 0) {
        document.getElementById('batchFullPalletsBreakdown').textContent = `1 неполная паллета`;
    } else {
        document.getElementById('batchFullPalletsBreakdown').textContent = `${fullPallets} полных (по ${rollsPerPallet} шт)`;
    }

    if (remainderRolls === 0 && totalPallets > 0) {
        document.getElementById('batchLastPalletRolls').textContent = `Полная (${rollsPerPallet} шт)`;
    } else if (remainderRolls > 0) {
        document.getElementById('batchLastPalletRolls').textContent = `${remainderRolls} из ${rollsPerPallet} рул. (${batch.lastPalletTiers} яр.)`;
    } else {
        document.getElementById('batchLastPalletRolls').textContent = `—`;
    }
    document.getElementById('batchLastPalletSpecs').textContent = `Вес: ${Math.round(batch.lastPalletGrossKg)} кг | Выс: ${batch.lastPalletHeightMm} мм`;

    document.getElementById('batchTotalGrossKg').textContent = Math.round(batch.totalBatchGrossKg).toLocaleString('ru-RU');
    const imprSuffix = state.printStepMm > 0 ? ` | Отт: ${batch.actualImpressionsWhole.toLocaleString('ru-RU')}` : '';
    document.getElementById('batchConsumablesSub').textContent = `Шпуль: ${totalRollsNeeded} шт | Листов: ${batch.totalSheetsAllPallets} л.${imprSuffix}`;
    renderComparison(calc, batch);
}

function updateUI(skipLengthInputSync = false, skipWeightInputSync = false) {
    if (state.autoSelectScheme && state.orientation === 'vertical') {
        autoSelectBestScheme();
    }

    let calc = calculateAll();

    const pyramidHintEl = document.getElementById('pyramidLimitHint');
    if (state.orientation === 'horizontal' && state.horizStackType === 'pyramid') {
        if (pyramidHintEl) {
            pyramidHintEl.classList.remove('hidden');
            document.getElementById('lblMaxPyramidTiers').textContent = calc.maxPyramidTiers;
        }
        if (state.tiers > calc.maxPyramidTiers) {
            state.tiers = calc.maxPyramidTiers;
            document.getElementById('inputTiers').value = state.tiers;
            calc = calculateAll();
        }
    } else if (pyramidHintEl) {
        pyramidHintEl.classList.add('hidden');
    }

    const inputRollLengthEl = document.getElementById('inputRollLength');
    if (!skipLengthInputSync && inputRollLengthEl && document.activeElement !== inputRollLengthEl) {
        inputRollLengthEl.value = Math.round(calc.lengthMeters * 1000) / 1000;
    }

    const inputTargetNetWeightEl = document.getElementById('inputTargetNetWeight');
    if (!skipWeightInputSync && inputTargetNetWeightEl && document.activeElement !== inputTargetNetWeightEl) {
        inputTargetNetWeightEl.value = calc.netWeightKg.toFixed(2);
    }

    const inputRollDiamEl = document.getElementById('inputRollDiam');
    if (inputRollDiamEl && document.activeElement !== inputRollDiamEl) {
        inputRollDiamEl.value = calc.D;
    }

    const sliderRollDiamEl = document.getElementById('sliderRollDiam');
    if (sliderRollDiamEl && document.activeElement !== sliderRollDiamEl) {
        sliderRollDiamEl.value = Math.min(DIAM_SLIDER_MAX, Math.max(DIAM_SLIDER_MIN, Math.round(calc.D)));
    }
    updateDiameterSliderVisual(calc.D);

    document.getElementById('lblCoreOuterDiam').textContent = `${calc.d_core} мм`;
    const singleCoreEl = document.getElementById('lblSingleCoreWeight');
    if (singleCoreEl) singleCoreEl.textContent = `${calc.coreWeightKg.toFixed(2)} кг`;

    const effThickEl = document.getElementById('lblEffectiveThickness');
    if (effThickEl) {
        effThickEl.textContent = calc.layers > 1
            ? `В витке: ${calc.effective_h_um} мкм (${calc.layers}×${calc.h_um})`
            : `В витке: ${calc.h_um} мкм`;
    }

    document.getElementById('resRollArea').textContent = calc.areaSqM.toFixed(1);
    const layerBadge = calc.layers > 1 ? ` ×${calc.layers}сл` : '';
    document.getElementById('resRollSpecSub').textContent = `${state.rollWidth}мм × ${state.thicknessMicrons}мкм${layerBadge}`;

    document.getElementById('resRollLength').textContent = formatRollMeters(calc.lengthMeters);

    const impLabelEl = document.getElementById('resRollImpressionsLabel');
    const impValEl = document.getElementById('resRollImpressions');
    const detImpEl = document.getElementById('detPalletImpressions');

    if (state.printStepMm > 0) {
        const streamTag = state.printStreams > 1 ? ` ×${state.printStreams}р` : '';
        if (impLabelEl) impLabelEl.textContent = `Оттисков (${state.printStepMm}мм${streamTag}):`;
        if (impValEl) {
            impValEl.textContent = `${calc.impPerRoll.wholeCount.toLocaleString('ru-RU')} шт (${calc.impPerRoll.exactCount.toFixed(1)})`;
        }
        if (detImpEl) {
            detImpEl.textContent = `${calc.totalPalletImpressionsWhole.toLocaleString('ru-RU')} шт (${Math.round(calc.totalPalletImpressionsExact).toLocaleString('ru-RU')} точн.)`;
        }
    } else {
        if (impLabelEl) impLabelEl.textContent = `Витков намотки:`;
        if (impValEl) impValEl.textContent = `${calc.turnsCount.toLocaleString('ru-RU')} вит.`;
        if (detImpEl) detImpEl.textContent = `Шаг печати не задан`;
    }

    renderPiecesInRoll(calc.lengthMeters);

    document.getElementById('resRollNetWeightMain').textContent = calc.netWeightKg.toFixed(2);
    document.getElementById('resRollGrossWeight').textContent = calc.grossWeightKg.toFixed(2);
    document.getElementById('resRollCoreSub').textContent = `${calc.coreWeightKg.toFixed(2)} кг`;

    document.getElementById('resTotalRolls').textContent = calc.totalRollsOnPallet;
    document.getElementById('resRollsBreakdown').textContent = (state.orientation === 'horizontal' && state.horizStackType === 'pyramid')
        ? `пирамида ${state.tiers} яр.`
        : `${calc.rollsPerTier} шт × ${state.tiers} яр.`;

    document.getElementById('resPalletGrossWeight').textContent = Math.round(calc.totalPalletGrossWeight).toLocaleString('ru-RU');
    document.getElementById('resPalletTotalArea').textContent = `${Math.round(calc.totalPalletArea).toLocaleString('ru-RU')} м²`;

    document.getElementById('lblSheetsPerPallet').textContent = `${calc.sheetsPerPallet} шт`;
    document.getElementById('lblPackagingTotalAdd').textContent = `+${calc.packagingAddWeightKg.toFixed(1)} кг`;

    const isHeightOver = calc.totalHeightMm > state.maxHeightLimitMm;
    const isWeightOver = calc.totalPalletGrossWeight > state.maxWeightLimitKg;
    const maxAllowedTiers = computeMaxAllowedTiers(calc);
    const limitsBox = document.getElementById('palletLimitsStatusBox');
    const limitsText = document.getElementById('palletLimitsStatusText');
    const limitsHint = document.getElementById('palletLimitsMaxTiersHint');

    if (isHeightOver || isWeightOver) {
        limitsBox.className = 'text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-800 border border-rose-300 flex items-center justify-between';
        const reasons = [];
        if (isHeightOver) reasons.push(`Высота ${calc.totalHeightMm} > ${state.maxHeightLimitMm} мм`);
        if (isWeightOver) reasons.push(`Вес ${Math.round(calc.totalPalletGrossWeight)} > ${state.maxWeightLimitKg} кг`);
        limitsText.textContent = `⚠ Превышение: ${reasons.join(', ')}`;
    } else {
        limitsBox.className = 'text-[11px] font-medium px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-between';
        limitsText.textContent = `✓ Высота (${calc.totalHeightMm} мм) и вес (${Math.round(calc.totalPalletGrossWeight)} кг) в норме`;
    }
    limitsHint.textContent = `Макс: ${maxAllowedTiers} яр.`;

    document.getElementById('detTotalArea').textContent = `${calc.totalPalletArea.toFixed(1)} м²`;
    document.getElementById('detTotalLength').textContent = `${Math.round(calc.totalPalletLength).toLocaleString('ru-RU')} пог. м`;
    document.getElementById('detPalletNetWeight').textContent = `${calc.totalPalletNetWeight.toFixed(1)} кг`;
    document.getElementById('detTareWeight').textContent = `${calc.totalTareWeight.toFixed(1)} кг`;

    const palletDim = PALLET_DIMENSIONS[state.palletType];
    document.getElementById('lblCanvasPalletDim').textContent = palletDim.name;
    document.getElementById('lblTotalPalletHeight').textContent = `Высота: ${calc.totalHeightMm} мм`;

    const activeScheme = state.schemes.find(s => s.id === state.activeSchemeId) || state.schemes[0];
    if (state.orientation === 'vertical' && activeScheme) {
        document.getElementById('badgeActiveSchemeName').textContent = `${activeScheme.title} (${activeScheme.points.length} шт/ярус)`;
    } else {
        document.getElementById('badgeActiveSchemeName').textContent = `Горизонтальная укладка (${calc.rollsPerTier} шт в нижнем ярусе)`;
    }

    updateBatchCalculationUI(calc);
    drawTopViewCanvas(calc);
    drawSideViewCanvas(calc);
    renderSchemeCards();
    fillPrintCard(calc);
}

/***********************************************************************
 * 6. ОБРАБОТЧИКИ СОБЫТИЙ И ПЕРЕКЛЮЧАТЕЛИ
 ***********************************************************************/
function setLengthAndRecalcDiam(lengthMetersVal, skipLengthInputSync = false, skipWeightInputSync = false) {
    let L = Number(lengthMetersVal);
    if (!(L > 0)) L = 0;
    const d_core = state.coreInnerDiam + 2 * (state.coreWall > 0 ? state.coreWall : 0);
    const effective_h_um = positiveOr(state.thicknessMicrons, 0) * Math.max(1, state.windingLayers);
    const minD = Math.round((d_core + 1) * 10) / 10;
    let preciseD = Math.max(minD, state.rollDiam || minD);
    let capped = false;
    if (L > 0 && effective_h_um > 0) {
        const newD = Math.sqrt((4 * effective_h_um * L) / Math.PI + d_core * d_core);
        const roundedD = Math.round(newD * 10) / 10;
        const hitsLimit = roundedD > 1200 || roundedD < minD;
        if (hitsLimit && roundedD < minD && skipLengthInputSync) return;
        preciseD = Math.min(1200, Math.max(minD, roundedD));
        capped = Math.abs(preciseD - roundedD) > 0.001;
        if (capped) L = filmLengthMeters(preciseD, d_core, effective_h_um);
    }
    state.exactLockedLength = L > 0 ? L : null;
    state.rollLength = L;
    state.rollDiam = preciseD;
    document.getElementById('inputRollDiam').value = preciseD;
    document.getElementById('sliderRollDiam').value = Math.min(DIAM_SLIDER_MAX, Math.max(DIAM_SLIDER_MIN, Math.round(preciseD)));
    const lenEl = document.getElementById('inputRollLength');
    if (lenEl && (!skipLengthInputSync || capped)) {
        lenEl.value = Math.round(L * 1000) / 1000;
    }
    updateUI(skipLengthInputSync && !capped, skipWeightInputSync && !capped);
}

function setNetWeightAndRecalc(targetNetKg) {
    const m_net = Number(targetNetKg);
    const h_um = positiveOr(state.thicknessMicrons, 0);
    const layers = Math.max(1, state.windingLayers);
    const B = positiveOr(state.rollWidth, 0);
    const rho = positiveOr(state.density, 0);
    if (!(m_net > 0) || !(h_um > 0) || !(B > 0) || !(rho > 0)) return;
    const requiredLengthM = (m_net * 1000000) / (B * layers * h_um * rho);
    setLengthAndRecalcDiam(requiredLengthM, false, true);
}

function setPrintStep(stepVal) {
    state.printStepMm = Math.max(0, parseFloat(stepVal) || 0);
    const el = document.getElementById('inputPrintStepMm');
    if (el) el.value = state.printStepMm;
    updateUI();
}

function selectPrintStreams(streamsCount) {
    state.printStreams = Math.max(1, Math.min(12, parseInt(streamsCount, 10) || 1));
    [1, 2, 3, 4].forEach(n => {
        const btn = document.getElementById('btnStreams_' + n);
        if (!btn) return;
        if (n === state.printStreams) {
            btn.className = 'px-2.5 py-0.5 rounded-md font-semibold bg-sky-600 text-white text-[11px] transition cursor-pointer';
        } else {
            btn.className = 'px-2.5 py-0.5 rounded-md font-medium text-slate-600 hover:text-slate-900 text-[11px] transition cursor-pointer';
        }
    });
    updateUI();
}

function selectWindingLayers(layersCount) {
    state.windingLayers = layersCount;
    [1, 2, 4].forEach(n => {
        const btn = document.getElementById('btnLayers_' + n);
        if (!btn) return;
        if (n === layersCount) {
            btn.className = 'p-2 rounded-lg border-2 border-blue-600 bg-blue-50/70 text-center transition cursor-pointer';
        } else {
            btn.className = 'p-2 rounded-lg border-2 border-slate-200 bg-white hover:bg-slate-50 text-center transition cursor-pointer';
        }
    });

    if (state.lockMode === 'length') {
        const targetLen = state.exactLockedLength || state.rollLength;
        setLengthAndRecalcDiam(targetLen, true);
    } else {
        state.exactLockedLength = null;
        updateUI();
    }
}

function setQuickBatchOrder(val, unit) {
    state.batchOrderValue = val;
    state.batchOrderUnit = unit;
    document.getElementById('inputBatchValue').value = val;
    document.getElementById('selectBatchUnit').value = unit;
    updateUI();
}

function setQuickLength(meters) {
    setLengthAndRecalcDiam(meters, false);
}

function setCalcLockMode(mode) {
    state.lockMode = mode;
    if (mode === 'length' && state.exactLockedLength === null) {
        state.exactLockedLength = state.rollLength;
    }
    const btnLen = document.getElementById('btnLockLength');
    const btnDiam = document.getElementById('btnLockDiam');
    if (mode === 'length') {
        btnLen.className = 'px-2 py-0.5 rounded-md font-semibold bg-blue-600 text-white transition cursor-pointer';
        btnDiam.className = 'px-2 py-0.5 rounded-md font-medium text-slate-600 hover:text-slate-900 transition cursor-pointer';
    } else {
        btnDiam.className = 'px-2 py-0.5 rounded-md font-semibold bg-blue-600 text-white transition cursor-pointer';
        btnLen.className = 'px-2 py-0.5 rounded-md font-medium text-slate-600 hover:text-slate-900 transition cursor-pointer';
    }
}

function setRollGap(gapVal) {
    state.rollGap = Math.max(0, gapVal);
    document.getElementById('inputRollGap').value = state.rollGap;
    updateUI();
}

function setQuickDiam(val) {
    state.exactLockedLength = null;
    state.rollDiam = val;
    document.getElementById('inputRollDiam').value = val;
    document.getElementById('sliderRollDiam').value = Math.min(DIAM_SLIDER_MAX, Math.max(DIAM_SLIDER_MIN, val));
    updateUI();
}

function setThickness(val) {
    state.thicknessMicrons = val;
    document.getElementById('inputThickness').value = val;
    if (state.lockMode === 'length') {
        const targetLen = state.exactLockedLength || state.rollLength;
        setLengthAndRecalcDiam(targetLen, true);
    } else {
        state.exactLockedLength = null;
        updateUI();
    }
}

function setWidth(val) {
    state.rollWidth = val;
    document.getElementById('inputWidth').value = val;
    updateUI();
}

function selectCore(innerMm) {
    state.coreInnerDiam = innerMm;
    if (innerMm === 152 && state.coreWall === 8) {
        state.coreWall = 12;
        document.getElementById('inputCoreWall').value = 12;
    } else if (innerMm === 76 && state.coreWall === 12) {
        state.coreWall = 8;
        document.getElementById('inputCoreWall').value = 8;
    }

    const btn76 = document.getElementById('btnCore76');
    const btn152 = document.getElementById('btnCore152');
    if (innerMm === 76) {
        btn76.className = 'flex items-center justify-between p-3 rounded-xl border-2 border-blue-600 bg-blue-50/70 text-left transition cursor-pointer';
        btn152.className = 'flex items-center justify-between p-3 rounded-xl border-2 border-slate-200 bg-white hover:bg-slate-50 text-left transition cursor-pointer';
    } else {
        btn152.className = 'flex items-center justify-between p-3 rounded-xl border-2 border-blue-600 bg-blue-50/70 text-left transition cursor-pointer';
        btn76.className = 'flex items-center justify-between p-3 rounded-xl border-2 border-slate-200 bg-white hover:bg-slate-50 text-left transition cursor-pointer';
    }

    if (state.lockMode === 'length') {
        const targetLen = state.exactLockedLength || state.rollLength;
        setLengthAndRecalcDiam(targetLen, true);
    } else {
        state.exactLockedLength = null;
        updateUI();
    }
}

function selectPallet(palletKey) {
    state.palletType = palletKey;
    const pInfo = PALLET_DIMENSIONS[palletKey];
    if (pInfo && pInfo.defaultWeight) {
        state.palletWoodWeight = pInfo.defaultWeight;
        document.getElementById('inputPalletWeight').value = pInfo.defaultWeight;
    }
    ['1200x800', '1100x1200', '1200x1200'].forEach(k => {
        const btn = document.getElementById('btnPallet_' + k);
        if (k === palletKey) {
            btn.className = 'pallet-btn p-2.5 rounded-xl border-2 border-blue-600 bg-blue-50/70 text-center transition cursor-pointer';
        } else {
            btn.className = 'pallet-btn p-2.5 rounded-xl border-2 border-slate-200 bg-white hover:bg-slate-50 text-center transition cursor-pointer';
        }
    });
    updateUI();
}

function selectOrientation(orient) {
    state.orientation = orient;
    const btnV = document.getElementById('btnOrient_vertical');
    const btnH = document.getElementById('btnOrient_horizontal');
    const horizPanel = document.getElementById('horizOptionsPanel');

    if (orient === 'vertical') {
        btnV.className = 'p-3 rounded-xl border-2 border-blue-600 bg-blue-50/70 text-left flex items-center gap-2.5 transition cursor-pointer';
        btnH.className = 'p-3 rounded-xl border-2 border-slate-200 bg-white hover:bg-slate-50 text-left flex items-center gap-2.5 transition cursor-pointer';
        horizPanel.classList.add('hidden');
    } else {
        btnH.className = 'p-3 rounded-xl border-2 border-blue-600 bg-blue-50/70 text-left flex items-center gap-2.5 transition cursor-pointer';
        btnV.className = 'p-3 rounded-xl border-2 border-slate-200 bg-white hover:bg-slate-50 text-left flex items-center gap-2.5 transition cursor-pointer';
        horizPanel.classList.remove('hidden');
    }
    updateUI();
}

function changeTiers(delta) {
    const next = Math.max(1, Math.min(20, state.tiers + delta));
    state.tiers = next;
    document.getElementById('inputTiers').value = next;
    updateUI();
}

function manualSelectScheme(schemeId) {
    state.activeSchemeId = schemeId;
    state.autoSelectScheme = false;
    document.getElementById('chkAutoScheme').checked = false;
    if (state.orientation !== 'vertical') {
        selectOrientation('vertical');
    } else {
        updateUI();
    }
}

function setSchemeFilter(filterKey) {
    state.schemeFilter = filterKey;
    ['all', 'standard', 'custom'].forEach(k => {
        const btn = document.getElementById('tabFilter' + k.charAt(0).toUpperCase() + k.slice(1));
        if (k === filterKey) {
            btn.className = 'px-2.5 py-1 rounded-md bg-white text-slate-800 shadow-sm cursor-pointer';
        } else {
            btn.className = 'px-2.5 py-1 rounded-md text-slate-600 hover:text-slate-900 cursor-pointer';
        }
    });
    renderSchemeCards();
}

function deleteCustomScheme(ev, schemeId) {
    ev.stopPropagation();
    state.schemes = state.schemes.filter(s => s.id !== schemeId);
    saveCustomSchemesToStorage();
    if (state.activeSchemeId === schemeId) {
        state.activeSchemeId = state.schemes[0].id;
    }
    updateUI();
}

/***********************************************************************
 * 7. ИНТЕРАКТИВНЫЙ КОНСТРУКТОР СВОИХ СХЕМ УКЛАДКИ
 ***********************************************************************/
let modalPointsMm = [];
let draggingPointIdx = -1;
let selectedModalPointIdx = 0;
let activeSnapGuides = [];

const modalSnapSettings = {
    snapToEdges: true,
    snapToRolls: true,
    clampInside: false
};

function updateModalSnapSettings() {
    const chkEdges = document.getElementById('chkModalSnapEdges');
    const chkRolls = document.getElementById('chkModalSnapRolls');
    const chkClamp = document.getElementById('chkModalClampInside');
    if (chkEdges) modalSnapSettings.snapToEdges = chkEdges.checked;
    if (chkRolls) modalSnapSettings.snapToRolls = chkRolls.checked;
    if (chkClamp) modalSnapSettings.clampInside = chkClamp.checked;

    if (modalSnapSettings.clampInside) {
        clampAllModalRollsInside();
    }
    drawModalEditorCanvas();
}

function clampAllModalRollsInside() {
    const palletKey = document.getElementById('modalPalletType').value;
    const pDim = PALLET_DIMENSIONS[palletKey];
    const maxD = Math.max(80, parseFloat(document.getElementById('modalMaxDiam').value) || 250);
    const r = maxD / 2;
    modalPointsMm = modalPointsMm.map(p => ({
        x: Math.max(r, Math.min(pDim.w - r, p.x)),
        y: Math.max(r, Math.min(pDim.h - r, p.y))
    }));
}

function setModalFormulaPreset(formulaStr, patternType) {
    document.getElementById('modalRowsInput').value = formulaStr;
    if (patternType) {
        document.getElementById('modalPatternType').value = patternType;
    }
    generateModalPointsFromFormula();
}

function openCustomModalFromCurrent() {
    const modal = document.getElementById('customSchemeModal');
    modal.classList.remove('hidden');

    const currentScheme = state.schemes.find(s => s.id === state.activeSchemeId) || state.schemes[0];
    document.getElementById('modalPalletType').value = state.palletType;
    document.getElementById('modalMaxDiam').value = Math.round(state.rollDiam);
    document.getElementById('modalSchemeTitle').value = `До ${Math.round(state.rollDiam)} мм — своя схема`;

    const pDim = PALLET_DIMENSIONS[state.palletType];
    if (currentScheme) {
        modalPointsMm = getActualRollPositionsMm(currentScheme, pDim.w, pDim.h, state.rollDiam, state.rollGap);
    } else {
        generateModalPointsFromFormula();
    }
    selectedModalPointIdx = modalPointsMm.length ? 0 : -1;
    syncSelectedRollInputs();
    drawModalEditorCanvas();
}

function closeCustomModal() {
    document.getElementById('customSchemeModal').classList.add('hidden');
}

function handleModalPatternChange() {
    const pattern = document.getElementById('modalPatternType').value;
    const formulaBox = document.getElementById('modalRowFormulaBox');
    if (pattern === 'freeform') {
        formulaBox.classList.add('opacity-50');
    } else {
        formulaBox.classList.remove('opacity-50');
        generateModalPointsFromFormula();
    }
}

function generateModalPointsFromFormula() {
    const palletKey = document.getElementById('modalPalletType').value;
    const pDim = PALLET_DIMENSIONS[palletKey];
    const maxD = Math.max(80, parseFloat(document.getElementById('modalMaxDiam').value) || 250);
    const r = maxD / 2;
    const pattern = document.getElementById('modalPatternType').value;

    if (pattern === 'corners_center') {
        modalPointsMm = [
            { x: r, y: r },
            { x: pDim.w - r, y: r },
            { x: r, y: pDim.h - r },
            { x: pDim.w - r, y: pDim.h - r },
            { x: pDim.w / 2, y: pDim.h / 2 }
        ];
        selectedModalPointIdx = modalPointsMm.length - 1;
        syncSelectedRollInputs();
        drawModalEditorCanvas();
        return;
    }

    if (pattern === 'perimeter') {
        const cols = Math.max(2, Math.floor(pDim.w / maxD));
        const rows = Math.max(2, Math.floor(pDim.h / maxD));
        const pts = [];
        const stepX = cols > 1 ? (pDim.w - maxD) / (cols - 1) : 0;
        const stepY = rows > 1 ? (pDim.h - maxD) / (rows - 1) : 0;
        for (let c = 0; c < cols; c++) pts.push({ x: r + c * stepX, y: r });
        for (let c = 0; c < cols; c++) pts.push({ x: r + c * stepX, y: pDim.h - r });
        for (let rw = 1; rw < rows - 1; rw++) {
            pts.push({ x: r, y: r + rw * stepY });
            pts.push({ x: pDim.w - r, y: r + rw * stepY });
        }
        modalPointsMm = pts;
        selectedModalPointIdx = 0;
        syncSelectedRollInputs();
        drawModalEditorCanvas();
        return;
    }

    const rawStr = document.getElementById('modalRowsInput').value;
    const rowCounts = rawStr.split(/[,;\s]+/).map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0 && n <= 20);
    if (!rowCounts.length) return;

    const s3 = Math.sqrt(3) / 2;
    const pts = [];

    if (pattern === 'grid') {
        rowCounts.forEach((cnt, rIdx) => {
            for (let c = 0; c < cnt; c++) pts.push({ x: c * maxD, y: rIdx * maxD });
        });
    } else if (pattern === 'staggered') {
        const maxCols = Math.max(...rowCounts);
        rowCounts.forEach((cnt, rIdx) => {
            const xOffset = ((maxCols - cnt) * maxD) / 2;
            for (let c = 0; c < cnt; c++) pts.push({ x: xOffset + c * maxD, y: rIdx * maxD * s3 });
        });
    } else if (pattern === 'wave') {
        const cols = rowCounts[0] || 4;
        const rows = rowCounts.length;
        for (let c = 0; c < cols; c++) {
            const yShift = (c % 2 === 1) ? maxD * 0.32 : 0;
            for (let rw = 0; rw < rows; rw++) pts.push({ x: c * (maxD * 0.92), y: rw * maxD + yShift });
        }
    } else {
        return;
    }

    modalPointsMm = pts;
    centerModalRolls();
}

function handleModalPalletTypeChange() {
    centerModalRolls();
}

function centerModalRolls() {
    if (!modalPointsMm.length) {
        drawModalEditorCanvas();
        return;
    }
    const palletKey = document.getElementById('modalPalletType').value;
    const pDim = PALLET_DIMENSIONS[palletKey];
    const maxD = Math.max(80, parseFloat(document.getElementById('modalMaxDiam').value) || 250);

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    modalPointsMm.forEach(p => {
        if (p.x - maxD / 2 < minX) minX = p.x - maxD / 2;
        if (p.x + maxD / 2 > maxX) maxX = p.x + maxD / 2;
        if (p.y - maxD / 2 < minY) minY = p.y - maxD / 2;
        if (p.y + maxD / 2 > maxY) maxY = p.y + maxD / 2;
    });

    const dx = (pDim.w - (maxX - minX)) / 2 - minX;
    const dy = (pDim.h - (maxY - minY)) / 2 - minY;
    modalPointsMm = modalPointsMm.map(p => ({ x: p.x + dx, y: p.y + dy }));
    syncSelectedRollInputs();
    drawModalEditorCanvas();
}

function snapAllModalRollsToEdges() {
    if (!modalPointsMm.length) return;
    const palletKey = document.getElementById('modalPalletType').value;
    const pDim = PALLET_DIMENSIONS[palletKey];
    const maxD = Math.max(80, parseFloat(document.getElementById('modalMaxDiam').value) || 250);
    const r = maxD / 2;

    if (modalPointsMm.length === 1) {
        modalPointsMm[0] = { x: r, y: r };
    } else {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        modalPointsMm.forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        });
        const spanX = maxX - minX;
        const spanY = maxY - minY;
        const targetSpanX = Math.max(0, pDim.w - maxD);
        const targetSpanY = Math.max(0, pDim.h - maxD);

        modalPointsMm = modalPointsMm.map(p => ({
            x: spanX > 10 ? r + ((p.x - minX) / spanX) * targetSpanX : p.x,
            y: spanY > 10 ? r + ((p.y - minY) / spanY) * targetSpanY : p.y
        }));
    }
    document.getElementById('modalPatternType').value = 'freeform';
    syncSelectedRollInputs();
    drawModalEditorCanvas();
}

function resolveModalCollisions() {
    if (modalPointsMm.length < 2) return;
    const palletKey = document.getElementById('modalPalletType').value;
    const pDim = PALLET_DIMENSIONS[palletKey];
    const maxD = Math.max(80, parseFloat(document.getElementById('modalMaxDiam').value) || 250);
    const r = maxD / 2;

    for (let iter = 0; iter < 80; iter++) {
        let moved = false;
        for (let i = 0; i < modalPointsMm.length; i++) {
            for (let j = i + 1; j < modalPointsMm.length; j++) {
                let dx = modalPointsMm[j].x - modalPointsMm[i].x;
                let dy = modalPointsMm[j].y - modalPointsMm[i].y;
                let dist = Math.hypot(dx, dy);
                if (dist < 0.1) {
                    dx = (Math.random() - 0.5) * 2;
                    dy = (Math.random() - 0.5) * 2;
                    dist = Math.hypot(dx, dy);
                }
                if (dist < maxD) {
                    const push = (maxD - dist) / 2 + 0.2;
                    const nx = dx / dist;
                    const ny = dy / dist;
                    modalPointsMm[i].x -= nx * push;
                    modalPointsMm[i].y -= ny * push;
                    modalPointsMm[j].x += nx * push;
                    modalPointsMm[j].y += ny * push;
                    moved = true;
                }
            }
        }
        if (modalSnapSettings.clampInside || modalSnapSettings.snapToEdges) {
            modalPointsMm.forEach(p => {
                p.x = Math.max(r, Math.min(pDim.w - r, p.x));
                p.y = Math.max(r, Math.min(pDim.h - r, p.y));
            });
        }
        if (!moved) break;
    }
    syncSelectedRollInputs();
    drawModalEditorCanvas();
}

function addRollToModalCanvas() {
    const palletKey = document.getElementById('modalPalletType').value;
    const pDim = PALLET_DIMENSIONS[palletKey];
    const maxD = Math.max(80, parseFloat(document.getElementById('modalMaxDiam').value) || 250);
    const r = maxD / 2;

    const candidateSpots = [
        { x: pDim.w / 2, y: pDim.h / 2 },
        { x: r, y: r },
        { x: pDim.w - r, y: r },
        { x: r, y: pDim.h - r },
        { x: pDim.w - r, y: pDim.h - r }
    ];
    let chosen = {
        x: pDim.w / 2 + (Math.random() - 0.5) * 80,
        y: pDim.h / 2 + (Math.random() - 0.5) * 80
    };
    for (const spot of candidateSpots) {
        const isOccupied = modalPointsMm.some(p => Math.hypot(p.x - spot.x, p.y - spot.y) < maxD * 0.85);
        if (!isOccupied) {
            chosen = spot;
            break;
        }
    }

    modalPointsMm.push(chosen);
    selectedModalPointIdx = modalPointsMm.length - 1;
    syncSelectedRollInputs();
    drawModalEditorCanvas();
}

function deleteSelectedModalRoll() {
    if (selectedModalPointIdx >= 0 && selectedModalPointIdx < modalPointsMm.length) {
        modalPointsMm.splice(selectedModalPointIdx, 1);
        selectedModalPointIdx = modalPointsMm.length ? Math.min(selectedModalPointIdx, modalPointsMm.length - 1) : -1;
        syncSelectedRollInputs();
        drawModalEditorCanvas();
    }
}

function syncSelectedRollInputs() {
    const panel = document.getElementById('selectedRollCoordsPanel');
    if (!panel) return;
    if (selectedModalPointIdx < 0 || selectedModalPointIdx >= modalPointsMm.length) {
        panel.classList.add('opacity-50');
        document.getElementById('lblSelectedRollNum').textContent = 'нет';
        document.getElementById('inputSelectedRollX').value = '';
        document.getElementById('inputSelectedRollY').value = '';
        return;
    }
    panel.classList.remove('opacity-50');
    const pt = modalPointsMm[selectedModalPointIdx];
    document.getElementById('lblSelectedRollNum').textContent = `#${selectedModalPointIdx + 1}`;
    document.getElementById('inputSelectedRollX').value = Math.round(pt.x);
    document.getElementById('inputSelectedRollY').value = Math.round(pt.y);
}

function updateSelectedRollFromInputs() {
    if (selectedModalPointIdx < 0 || selectedModalPointIdx >= modalPointsMm.length) return;
    const vx = parseFloat(document.getElementById('inputSelectedRollX').value);
    const vy = parseFloat(document.getElementById('inputSelectedRollY').value);
    if (!isNaN(vx)) modalPointsMm[selectedModalPointIdx].x = vx;
    if (!isNaN(vy)) modalPointsMm[selectedModalPointIdx].y = vy;
    drawModalEditorCanvas();
}

function clearModalRolls() {
    modalPointsMm = [];
    selectedModalPointIdx = -1;
    syncSelectedRollInputs();
    drawModalEditorCanvas();
}

function updateModalPreview() {
    if (modalSnapSettings.clampInside) {
        clampAllModalRollsInside();
    }
    syncSelectedRollInputs();
    drawModalEditorCanvas();
}

function applyModalSnapping(rawX, rawY, movingIdx) {
    const palletKey = document.getElementById('modalPalletType').value;
    const pDim = PALLET_DIMENSIONS[palletKey];
    const maxD = Math.max(80, parseFloat(document.getElementById('modalMaxDiam').value) || 250);
    const r = maxD / 2;
    const snapThresholdMm = 26;

    let x = rawX;
    let y = rawY;
    activeSnapGuides = [];

    if (modalSnapSettings.snapToEdges) {
        const snapCandidatesX = [r, pDim.w - r, pDim.w / 2];
        const snapCandidatesY = [r, pDim.h - r, pDim.h / 2];

        for (const val of snapCandidatesX) {
            if (Math.abs(x - val) <= snapThresholdMm) {
                x = val;
                activeSnapGuides.push({ type: 'x', val });
                break;
            }
        }
        for (const val of snapCandidatesY) {
            if (Math.abs(y - val) <= snapThresholdMm) {
                y = val;
                activeSnapGuides.push({ type: 'y', val });
                break;
            }
        }
    }

    if (modalSnapSettings.snapToRolls) {
        for (let i = 0; i < modalPointsMm.length; i++) {
            if (i === movingIdx) continue;
            const other = modalPointsMm[i];

            if (Math.abs(x - other.x) <= 18) {
                x = other.x;
                activeSnapGuides.push({ type: 'x', val: other.x });
            }
            if (Math.abs(y - other.y) <= 18) {
                y = other.y;
                activeSnapGuides.push({ type: 'y', val: other.y });
            }

            const dx = x - other.x;
            const dy = y - other.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 10 && Math.abs(dist - maxD) <= snapThresholdMm) {
                const angle = Math.atan2(dy, dx);
                x = other.x + Math.cos(angle) * maxD;
                y = other.y + Math.sin(angle) * maxD;
                activeSnapGuides.push({ type: 'roll', x1: other.x, y1: other.y, x2: x, y2: y });
            }
        }
    }

    if (modalSnapSettings.clampInside) {
        x = Math.max(r, Math.min(pDim.w - r, x));
        y = Math.max(r, Math.min(pDim.h - r, y));
    }

    return { x, y };
}

function getModalCanvasTransform() {
    const canvas = document.getElementById('canvasModalEditor');
    const palletKey = document.getElementById('modalPalletType').value;
    const pDim = PALLET_DIMENSIONS[palletKey];
    const cw = canvas.width;
    const ch = canvas.height;
    const pad = 28;
    const scale = Math.min((cw - pad * 2) / pDim.w, (ch - pad * 2) / pDim.h);
    const pw = pDim.w * scale;
    const ph = pDim.h * scale;
    const ox = (cw - pw) / 2;
    const oy = (ch - ph) / 2;
    return { canvas, pDim, cw, ch, scale, pw, ph, ox, oy };
}

function drawModalEditorCanvas() {
    const { canvas, pDim, scale, pw, ph, ox, oy } = getModalCanvasTransform();
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const maxD = Math.max(80, parseFloat(document.getElementById('modalMaxDiam').value) || 250);
    const rMm = maxD / 2;
    const rPx = rMm * scale;

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 2.5;
    ctx.fillRect(ox, oy, pw, ph);
    ctx.strokeRect(ox, oy, pw, ph);

    ctx.fillStyle = '#64748b';
    ctx.font = '600 11px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${pDim.w} мм`, ox + pw / 2, oy - 8);
    ctx.save();
    ctx.translate(ox - 10, oy + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${pDim.h} мм`, 0, 0);
    ctx.restore();

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ox + pw / 2, oy);
    ctx.lineTo(ox + pw / 2, oy + ph);
    ctx.moveTo(ox, oy + ph / 2);
    ctx.lineTo(ox + pw, oy + ph / 2);
    ctx.stroke();

    if (draggingPointIdx !== -1 && activeSnapGuides.length > 0) {
        ctx.save();
        ctx.strokeStyle = '#4f46e5';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        activeSnapGuides.forEach(g => {
            ctx.beginPath();
            if (g.type === 'x') {
                const gx = ox + g.val * scale;
                ctx.moveTo(gx, oy);
                ctx.lineTo(gx, oy + ph);
            } else if (g.type === 'y') {
                const gy = oy + g.val * scale;
                ctx.moveTo(ox, gy);
                ctx.lineTo(ox + pw, gy);
            } else if (g.type === 'roll') {
                ctx.moveTo(ox + g.x1 * scale, oy + g.y1 * scale);
                ctx.lineTo(ox + g.x2 * scale, oy + g.y2 * scale);
            }
            ctx.stroke();
        });
        ctx.restore();
    }

    const overlappingSet = new Set();
    const overlapPairs = [];
    let maxOverlapMm = 0;

    for (let i = 0; i < modalPointsMm.length; i++) {
        for (let j = i + 1; j < modalPointsMm.length; j++) {
            const dist = Math.hypot(modalPointsMm[i].x - modalPointsMm[j].x, modalPointsMm[i].y - modalPointsMm[j].y);
            const overlap = maxD - dist;
            if (overlap > 1.5) {
                overlappingSet.add(i);
                overlappingSet.add(j);
                if (overlap > maxOverlapMm) maxOverlapMm = overlap;
                overlapPairs.push({ i, j, overlap: Math.round(overlap) });
            }
        }
    }

    let overhangCount = 0;
    let maxOverhangMm = 0;

    modalPointsMm.forEach((pt, idx) => {
        const overL = Math.max(0, rMm - pt.x);
        const overR = Math.max(0, (pt.x + rMm) - pDim.w);
        const overT = Math.max(0, rMm - pt.y);
        const overB = Math.max(0, (pt.y + rMm) - pDim.h);
        const overMax = Math.max(overL, overR, overT, overB);
        const isOut = overMax > 2;
        if (isOut) {
            overhangCount++;
            if (overMax > maxOverhangMm) maxOverhangMm = overMax;
        }

        const isColliding = overlappingSet.has(idx);
        const isSelected = (idx === selectedModalPointIdx);

        const cx = ox + pt.x * scale;
        const cy = oy + pt.y * scale;

        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(4, rPx), 0, Math.PI * 2);

        if (isColliding) {
            ctx.fillStyle = 'rgba(225, 29, 72, 0.85)';
            ctx.strokeStyle = '#881337';
        } else if (isOut) {
            ctx.fillStyle = 'rgba(245, 158, 11, 0.85)';
            ctx.strokeStyle = '#b45309';
        } else {
            ctx.fillStyle = (idx === draggingPointIdx) ? '#2563eb' : '#3b6fc4';
            ctx.strokeStyle = '#1e3a8a';
        }
        ctx.fill();
        ctx.lineWidth = isSelected ? 3 : 1.5;
        ctx.stroke();

        if (isSelected) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, Math.max(2, rPx - 4), 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 3]);
            ctx.stroke();
            ctx.restore();
        }

        ctx.fillStyle = '#ffffff';
        ctx.font = '700 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(idx + 1, cx, cy);
    });

    overlapPairs.forEach(pair => {
        const p1 = modalPointsMm[pair.i];
        const p2 = modalPointsMm[pair.j];
        const x1 = ox + p1.x * scale, y1 = oy + p1.y * scale;
        const x2 = ox + p2.x * scale, y2 = oy + p2.y * scale;
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;

        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        const label = `-${pair.overlap} мм`;
        ctx.font = '700 10px JetBrains Mono, monospace';
        const tw = ctx.measureText(label).width + 8;
        ctx.fillStyle = '#881337';
        ctx.fillRect(mx - tw / 2, my - 8, tw, 16);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, mx, my);
        ctx.restore();
    });

    document.getElementById('modalRollCountBadge').textContent = modalPointsMm.length;

    const banner = document.getElementById('modalCollisionBanner');
    const bannerTxt = document.getElementById('modalCollisionText');
    const diagGapMm = Math.round(Math.hypot(pDim.w - maxD, pDim.h - maxD) - maxD);

    if (overlapPairs.length > 0) {
        banner.className = 'mb-2 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between bg-rose-50 text-rose-800 border border-rose-300';
        bannerTxt.textContent = `⚠ Обнаружен нахлест рулонов (${overlapPairs.length} пересеч., макс. -${Math.round(maxOverlapMm)} мм)! Нажмите «Убрать нахлесты» или уменьшите Ø.`;
    } else if (overhangCount > 0) {
        banner.className = 'mb-2 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between bg-amber-50 text-amber-900 border border-amber-300';
        bannerTxt.textContent = `⚠ Выход за край паллеты у ${overhangCount} рул. (свес ~${Math.round(maxOverhangMm)} мм).`;
    } else {
        banner.className = 'mb-2 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between bg-emerald-50 text-emerald-800 border border-emerald-200';
        bannerTxt.textContent = '✓ Все рулоны размещены без нахлестов и свесов.';
    }
    const freeSpaceEl = document.getElementById('modalFreeSpaceInfo');
    if (freeSpaceEl) {
        freeSpaceEl.textContent = `Окно в центре: ${diagGapMm} мм`;
    }
}

function saveCustomScheme() {
    if (!modalPointsMm.length) {
        document.getElementById('modalValidationMsg').textContent = 'Добавьте хотя бы 1 рулон на схему!';
        document.getElementById('modalValidationMsg').className = 'text-xs text-rose-600 font-semibold';
        return;
    }

    const maxD = Math.max(80, parseFloat(document.getElementById('modalMaxDiam').value) || 250);
    const palletKey = document.getElementById('modalPalletType').value;
    const pDim = PALLET_DIMENSIONS[palletKey];
    const pattern = document.getElementById('modalPatternType').value;
    const customTitle = document.getElementById('modalSchemeTitle').value.trim() || `До ${maxD} мм`;

    const newScheme = {
        id: 'custom_' + Date.now(),
        title: customTitle,
        subtitle: `${modalPointsMm.length} ${pluralizeRolls(modalPointsMm.length)} (своя схема)`,
        maxDiam: maxD,
        rollsCount: modalPointsMm.length,
        shifted: pattern !== 'grid',
        pallet: palletKey,
        isStandard: false,
        isCustom: true,
        points: modalPointsMm.map(p => ({
            nx: p.x / pDim.w,
            ny: p.y / pDim.h
        }))
    };

    state.schemes.push(newScheme);
    saveCustomSchemesToStorage();

    state.palletType = palletKey;
    state.exactLockedLength = null;
    state.rollDiam = maxD;
    document.getElementById('inputRollDiam').value = maxD;
    document.getElementById('sliderRollDiam').value = Math.min(DIAM_SLIDER_MAX, Math.max(DIAM_SLIDER_MIN, maxD));
    selectPallet(palletKey);

    manualSelectScheme(newScheme.id);
    closeCustomModal();
}

/***********************************************************************
 * 8. ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ СТРАНИЦЫ
 ***********************************************************************/
window.addEventListener('DOMContentLoaded', () => {
    buildDiameterScaleTicks();
    initSchemes();
    loadSavedCalcs();
    loadPackPrices();

    const inputRollDiam = document.getElementById('inputRollDiam');
    const sliderRollDiam = document.getElementById('sliderRollDiam');

    function parseUserNumber(raw) {
        if (raw == null) return NaN;
        const s = String(raw).trim().replace(/[\s\u00a0\u202f]/g, '').replace(',', '.');
        if (s === '' || s === '-' || s === '+' || s === '.' || s === '-.' || s === '+.') return NaN;
        const n = Number(s);
        return Number.isFinite(n) ? n : NaN;
    }

    function numberStillTyping(raw) {
        const s = String(raw).trim().replace(',', '.');
        return s === '' || s === '-' || s === '+' || s === '.' || s === '-.' || s.endsWith('.');
    }

    function writeInputValue(el, next, caret) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(el, next);
        if (caret != null) {
            try { el.setSelectionRange(caret, caret); } catch (err) { /* курсор недоступен */ }
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function bindDecimalComma(el) {
        if (!el || el.dataset.decimalComma === '1') return;
        el.dataset.decimalComma = '1';
        el.addEventListener('keydown', (e) => {
            if (e.key !== ',' && e.key !== 'Decimal') return;
            e.preventDefault();
            const start = el.selectionStart == null ? el.value.length : el.selectionStart;
            const end = el.selectionEnd == null ? el.value.length : el.selectionEnd;
            const next = el.value.slice(0, start) + '.' + el.value.slice(end);
            if ((next.match(/\./g) || []).length > 1) return;
            writeInputValue(el, next, start + 1);
        });
        el.addEventListener('beforeinput', (e) => {
            if (!e.data || !String(e.data).includes(',')) return;
            e.preventDefault();
            if (e.data === ',') return;
            const start = el.selectionStart == null ? el.value.length : el.selectionStart;
            const end = el.selectionEnd == null ? el.value.length : el.selectionEnd;
            const chunk = String(e.data).replace(/,/g, '.');
            writeInputValue(el, el.value.slice(0, start) + chunk + el.value.slice(end), start + chunk.length);
        });
    }

    document.querySelectorAll('input[inputmode="decimal"]').forEach(bindDecimalComma);

    function bindCheckedNumber(el, opts) {
        if (!el) return;
        bindDecimalComma(el);
        const minOf = () => (typeof opts.min === 'function' ? opts.min() : opts.min);
        const maxOf = () => (opts.max == null ? null : (typeof opts.max === 'function' ? opts.max() : opts.max));
        const read = () => (opts.integer ? parseInt(el.value, 10) : parseUserNumber(el.value));
        const inRange = (v) => {
            if (!Number.isFinite(v)) return false;
            if (v < minOf()) return false;
            const max = maxOf();
            if (max != null && v > max) return false;
            if (!opts.allowZero && v === 0) return false;
            return true;
        };
        const revert = () => {
            const shown = opts.display();
            el.value = shown === '' || shown == null ? '' : shown;
        };
        const accept = (v, kind) => {
            const max = maxOf();
            if (opts.capHigh && max != null && v > max) v = max;
            opts.onValid(v, kind);
        };
        const handle = (kind) => {
            const raw = String(el.value).trim();
            if (raw === '' && opts.emptyIsZero) {
                opts.onValid(0);
                return;
            }
            if (kind === 'input' && numberStillTyping(el.value)) return;
            const v = read();
            if (inRange(v)) {
                accept(v, kind);
                return;
            }
            const negative = Number.isFinite(v) && v < 0;
            const bareZero = Number.isFinite(v) && v === 0 && minOf() >= 1;
            if (kind === 'change' || negative || bareZero) {
                if (opts.capHigh && Number.isFinite(v) && maxOf() != null && v > maxOf()) {
                    accept(v, kind);
                    return;
                }
                revert();
            }
        };
        el.addEventListener('input', () => handle('input'));
        el.addEventListener('change', () => handle('change'));
    }

    function coreOuterMinDiam() {
        const wall = state.coreWall > 0 ? state.coreWall : 0;
        return state.coreInnerDiam + 2 * wall + 1;
    }

    function applyThicknessLike(assign) {
        return (v) => {
            assign(v);
            if (state.lockMode === 'length') {
                const targetLen = state.exactLockedLength || state.rollLength;
                setLengthAndRecalcDiam(targetLen, true);
            } else {
                state.exactLockedLength = null;
                updateUI();
            }
        };
    }

    bindCheckedNumber(inputRollDiam, {
        min: coreOuterMinDiam,
        max: 1200,
        capHigh: true,
        display: () => state.rollDiam,
        onValid: (v) => {
            state.exactLockedLength = null;
            state.rollDiam = v;
            sliderRollDiam.value = Math.min(DIAM_SLIDER_MAX, Math.max(DIAM_SLIDER_MIN, Math.round(v)));
            updateUI();
        }
    });

    sliderRollDiam.addEventListener('input', (e) => {
        const v = parseFloat(e.target.value);
        state.exactLockedLength = null;
        state.rollDiam = v;
        inputRollDiam.value = v;
        updateUI();
    });

    const inputRollLength = document.getElementById('inputRollLength');
    bindCheckedNumber(inputRollLength, {
        min: 0.001,
        max: 100000,
        capHigh: true,
        display: () => Math.round((state.exactLockedLength || state.rollLength || 0) * 1000) / 1000,
        onValid: (v, kind) => setLengthAndRecalcDiam(v, kind === 'input', false)
    });

    const inputTargetNetWeight = document.getElementById('inputTargetNetWeight');
    bindCheckedNumber(inputTargetNetWeight, {
        min: 0.01,
        max: 2000,
        capHigh: true,
        display: () => document.getElementById('resRollNetWeightMain').textContent,
        onValid: (v) => setNetWeightAndRecalc(v)
    });

    bindCheckedNumber(document.getElementById('inputPrintStepMm'), {
        min: 0,
        max: 5000,
        allowZero: true,
        emptyIsZero: true,
        capHigh: true,
        display: () => state.printStepMm,
        onValid: (v) => {
            state.printStepMm = v > 0 ? v : 0;
            updateUI();
        }
    });

    bindCheckedNumber(document.getElementById('inputCoreWall'), {
        min: 0,
        max: 35,
        allowZero: true,
        capHigh: true,
        display: () => state.coreWall,
        onValid: applyThicknessLike((v) => { state.coreWall = v; })
    });

    bindCheckedNumber(document.getElementById('inputCoreDensity'), {
        min: 0.01,
        max: 2,
        capHigh: true,
        display: () => state.coreDensity,
        onValid: (v) => {
            state.coreDensity = v;
            updateUI();
        }
    });

    bindCheckedNumber(document.getElementById('inputThickness'), {
        min: 0.01,
        max: 2000,
        capHigh: true,
        display: () => state.thicknessMicrons,
        onValid: applyThicknessLike((v) => { state.thicknessMicrons = v; })
    });

    bindCheckedNumber(document.getElementById('inputRollGap'), {
        min: 0,
        max: 200,
        allowZero: true,
        capHigh: true,
        display: () => state.rollGap,
        onValid: (v) => {
            state.rollGap = v;
            updateUI();
        }
    });

    bindCheckedNumber(document.getElementById('inputWidth'), {
        min: 1,
        max: 3000,
        capHigh: true,
        display: () => state.rollWidth,
        onValid: (v) => {
            state.rollWidth = v;
            updateUI();
        }
    });

    const selectMaterial = document.getElementById('selectMaterial');
    const inputDensity = document.getElementById('inputDensity');

    selectMaterial.addEventListener('change', (e) => {
        if (e.target.value !== 'custom') {
            const rho = parseFloat(e.target.value);
            state.density = rho;
            inputDensity.value = rho;
            updateUI();
        }
    });

    bindCheckedNumber(inputDensity, {
        min: 0.01,
        max: 5,
        capHigh: true,
        display: () => state.density,
        onValid: (v) => {
            state.density = v;
            selectMaterial.value = 'custom';
            updateUI();
        }
    });

    bindCheckedNumber(document.getElementById('inputTiers'), {
        min: 1,
        max: 20,
        integer: true,
        capHigh: true,
        display: () => state.tiers,
        onValid: (v) => {
            state.tiers = v;
            updateUI();
        }
    });

    bindCheckedNumber(document.getElementById('inputPalletWeight'), {
        min: 0,
        max: 100,
        allowZero: true,
        capHigh: true,
        display: () => state.palletWoodWeight,
        onValid: (v) => {
            state.palletWoodWeight = v;
            updateUI();
        }
    });

    bindCheckedNumber(document.getElementById('inputMaxHeightLimit'), {
        min: 300,
        max: 3500,
        capHigh: true,
        display: () => state.maxHeightLimitMm,
        onValid: (v) => {
            state.maxHeightLimitMm = v;
            updateUI();
        }
    });

    bindCheckedNumber(document.getElementById('inputMaxWeightLimit'), {
        min: 50,
        max: 3000,
        capHigh: true,
        display: () => state.maxWeightLimitKg,
        onValid: (v) => {
            state.maxWeightLimitKg = v;
            updateUI();
        }
    });

    document.getElementById('chkUseInterlayer').addEventListener('change', (e) => {
        state.useInterlayer = e.target.checked;
        const grid = document.getElementById('interlayerSettingsGrid');
        if (grid) grid.classList.toggle('opacity-40', !state.useInterlayer);
        updateUI();
    });

    bindCheckedNumber(document.getElementById('inputSheetThickness'), {
        min: 0,
        max: 30,
        allowZero: true,
        capHigh: true,
        display: () => state.interlayerThickMm,
        onValid: (v) => {
            state.interlayerThickMm = v;
            updateUI();
        }
    });

    bindCheckedNumber(document.getElementById('inputSheetWeight'), {
        min: 0,
        max: 20,
        allowZero: true,
        capHigh: true,
        display: () => state.interlayerWeightKg,
        onValid: (v) => {
            state.interlayerWeightKg = v;
            updateUI();
        }
    });

    bindCheckedNumber(document.getElementById('inputWrapWeight'), {
        min: 0,
        max: 30,
        allowZero: true,
        capHigh: true,
        display: () => state.stretchWrapWeightKg,
        onValid: (v) => {
            state.stretchWrapWeightKg = v;
            updateUI();
        }
    });

    bindCheckedNumber(document.getElementById('pricePallet'), {
        min: 0,
        max: 1000000,
        allowZero: true,
        emptyIsZero: true,
        capHigh: true,
        display: () => state.packPrices.pallet,
        onValid: (v) => {
            state.packPrices.pallet = v > 0 ? v : 0;
            persistPackPrices();
            updateUI();
        }
    });

    bindCheckedNumber(document.getElementById('priceSheet'), {
        min: 0,
        max: 1000000,
        allowZero: true,
        emptyIsZero: true,
        capHigh: true,
        display: () => state.packPrices.sheet,
        onValid: (v) => {
            state.packPrices.sheet = v > 0 ? v : 0;
            persistPackPrices();
            updateUI();
        }
    });

    bindCheckedNumber(document.getElementById('priceStretch'), {
        min: 0,
        max: 1000000,
        allowZero: true,
        emptyIsZero: true,
        capHigh: true,
        display: () => state.packPrices.stretch,
        onValid: (v) => {
            state.packPrices.stretch = v > 0 ? v : 0;
            persistPackPrices();
            updateUI();
        }
    });

    bindCheckedNumber(document.getElementById('priceCore'), {
        min: 0,
        max: 1000000,
        allowZero: true,
        emptyIsZero: true,
        capHigh: true,
        display: () => state.packPrices.core,
        onValid: (v) => {
            state.packPrices.core = v > 0 ? v : 0;
            persistPackPrices();
            updateUI();
        }
    });

    document.getElementById('btnSaveComparison').addEventListener('click', saveCurrentCalc);
    document.getElementById('compareTableBody').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-delete-calc]');
        if (!btn) return;
        deleteSavedCalc(btn.getAttribute('data-delete-calc'));
    });

    bindCheckedNumber(document.getElementById('inputBatchValue'), {
        min: 0,
        allowZero: true,
        emptyIsZero: true,
        display: () => state.batchOrderValue,
        onValid: (v) => {
            state.batchOrderValue = v > 0 ? v : 0;
            updateUI();
        }
    });

    document.getElementById('selectBatchUnit').addEventListener('change', (e) => {
        state.batchOrderUnit = e.target.value;
        updateUI();
    });

    document.getElementById('chkAutoScheme').addEventListener('change', (e) => {
        state.autoSelectScheme = e.target.checked;
        updateUI();
    });

    document.getElementById('selectHorizAxis').addEventListener('change', (e) => {
        state.horizAxis = e.target.value;
        updateUI();
    });

    document.getElementById('selectHorizStackType').addEventListener('change', (e) => {
        state.horizStackType = e.target.value;
        updateUI();
    });

    document.getElementById('btnOpenCustomModal').addEventListener('click', () => {
        openCustomModalFromCurrent();
    });

    document.getElementById('btnResetDefaults').addEventListener('click', () => {
        state.rollDiam = 235;
        state.rollLength = 734.15;
        state.exactLockedLength = null;
        state.lockMode = 'length';
        state.coreInnerDiam = 76;
        state.coreWall = 8;
        state.coreDensity = 0.72;
        state.thicknessMicrons = 50;
        state.windingLayers = 1;
        state.rollWidth = 500;
        state.printStepMm = 250;
        state.printStreams = 1;
        state.density = 0.92;
        state.rollGap = 0;
        state.tiers = 3;
        state.palletWoodWeight = 22;
        state.maxHeightLimitMm = 1800;
        state.maxWeightLimitKg = 1000;
        state.useInterlayer = true;
        state.interlayerThickMm = 4;
        state.interlayerWeightKg = 0.8;
        state.stretchWrapWeightKg = 1.5;
        state.batchOrderValue = 3000;
        state.batchOrderUnit = 'kg';
        state.autoSelectScheme = true;

        document.getElementById('inputRollDiam').value = 235;
        document.getElementById('sliderRollDiam').value = 235;
        document.getElementById('inputCoreWall').value = 8;
        document.getElementById('inputCoreDensity').value = 0.72;
        document.getElementById('inputThickness').value = 50;
        document.getElementById('inputWidth').value = 500;
        document.getElementById('inputPrintStepMm').value = 250;
        document.getElementById('selectMaterial').value = '0.92';
        document.getElementById('inputDensity').value = 0.92;
        document.getElementById('inputRollGap').value = 0;
        document.getElementById('inputTiers').value = 3;
        document.getElementById('inputPalletWeight').value = 22;
        document.getElementById('inputMaxHeightLimit').value = 1800;
        document.getElementById('inputMaxWeightLimit').value = 1000;
        document.getElementById('chkUseInterlayer').checked = true;
        document.getElementById('interlayerSettingsGrid').classList.remove('opacity-40');
        document.getElementById('inputSheetThickness').value = 4;
        document.getElementById('inputSheetWeight').value = 0.8;
        document.getElementById('inputWrapWeight').value = 1.5;
        document.getElementById('inputBatchValue').value = 3000;
        document.getElementById('selectBatchUnit').value = 'kg';
        document.getElementById('chkAutoScheme').checked = true;

        selectPrintStreams(1);
        setCalcLockMode('length');
        selectWindingLayers(1);
        selectCore(76);
        selectPallet('1200x800');
        selectOrientation('vertical');
    });

    const modalCanvas = document.getElementById('canvasModalEditor');

    function getMousePosOnModalPallet(evt) {
        const rect = modalCanvas.getBoundingClientRect();
        const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
        const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;
        const xPx = (clientX - rect.left) * (modalCanvas.width / rect.width);
        const yPx = (clientY - rect.top) * (modalCanvas.height / rect.height);
        const { ox, oy, scale } = getModalCanvasTransform();
        return {
            mmX: (xPx - ox) / scale,
            mmY: (yPx - oy) / scale
        };
    }

    modalCanvas.addEventListener('mousedown', (e) => {
        const pos = getMousePosOnModalPallet(e);
        const maxD = Math.max(80, parseFloat(document.getElementById('modalMaxDiam').value) || 250);
        let hitIdx = -1;
        for (let i = modalPointsMm.length - 1; i >= 0; i--) {
            if (Math.hypot(modalPointsMm[i].x - pos.mmX, modalPointsMm[i].y - pos.mmY) <= maxD / 2) {
                hitIdx = i;
                break;
            }
        }

        if (e.button === 2 || e.shiftKey) {
            if (hitIdx !== -1) {
                modalPointsMm.splice(hitIdx, 1);
                selectedModalPointIdx = modalPointsMm.length ? Math.min(hitIdx, modalPointsMm.length - 1) : -1;
                syncSelectedRollInputs();
                drawModalEditorCanvas();
            }
            return;
        }

        if (hitIdx !== -1) {
            draggingPointIdx = hitIdx;
            selectedModalPointIdx = hitIdx;
            document.getElementById('modalPatternType').value = 'freeform';
            syncSelectedRollInputs();
            drawModalEditorCanvas();
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (draggingPointIdx === -1) return;
        const pos = getMousePosOnModalPallet(e);
        const snapped = applyModalSnapping(pos.mmX, pos.mmY, draggingPointIdx);
        modalPointsMm[draggingPointIdx].x = snapped.x;
        modalPointsMm[draggingPointIdx].y = snapped.y;
        syncSelectedRollInputs();
        drawModalEditorCanvas();
    });

    window.addEventListener('mouseup', () => {
        if (draggingPointIdx !== -1) {
            draggingPointIdx = -1;
            activeSnapGuides = [];
            drawModalEditorCanvas();
        }
    });

    modalCanvas.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        const pos = getMousePosOnModalPallet(e);
        const maxD = Math.max(80, parseFloat(document.getElementById('modalMaxDiam').value) || 250);
        let hitIdx = -1;
        for (let i = modalPointsMm.length - 1; i >= 0; i--) {
            if (Math.hypot(modalPointsMm[i].x - pos.mmX, modalPointsMm[i].y - pos.mmY) <= maxD / 2) {
                hitIdx = i;
                break;
            }
        }
        if (hitIdx !== -1) {
            e.preventDefault();
            draggingPointIdx = hitIdx;
            selectedModalPointIdx = hitIdx;
            document.getElementById('modalPatternType').value = 'freeform';
            syncSelectedRollInputs();
            drawModalEditorCanvas();
        }
    }, { passive: false });

    modalCanvas.addEventListener('touchmove', (e) => {
        if (draggingPointIdx === -1 || e.touches.length !== 1) return;
        e.preventDefault();
        const pos = getMousePosOnModalPallet(e);
        const snapped = applyModalSnapping(pos.mmX, pos.mmY, draggingPointIdx);
        modalPointsMm[draggingPointIdx].x = snapped.x;
        modalPointsMm[draggingPointIdx].y = snapped.y;
        syncSelectedRollInputs();
        drawModalEditorCanvas();
    }, { passive: false });

    modalCanvas.addEventListener('touchend', () => {
        if (draggingPointIdx !== -1) {
            draggingPointIdx = -1;
            activeSnapGuides = [];
            drawModalEditorCanvas();
        }
    });

    modalCanvas.addEventListener('dblclick', (e) => {
        const pos = getMousePosOnModalPallet(e);
        const snapped = applyModalSnapping(pos.mmX, pos.mmY, -1);
        modalPointsMm.push({ x: snapped.x, y: snapped.y });
        selectedModalPointIdx = modalPointsMm.length - 1;
        activeSnapGuides = [];
        document.getElementById('modalPatternType').value = 'freeform';
        syncSelectedRollInputs();
        drawModalEditorCanvas();
    });

    modalCanvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    window.addEventListener('resize', () => {
        updateUI();
    });

    updateUI();
});

Object.assign(window, {
    setQuickDiam,
    setQuickLength,
    setNetWeightAndRecalc,
    setPrintStep,
    selectPrintStreams,
    setCalcLockMode,
    setRollGap,
    setThickness,
    setWidth,
    selectWindingLayers,
    selectCore,
    selectPallet,
    selectOrientation,
    changeTiers,
    autoFitTiersToLimits,
    setQuickBatchOrder,
    manualSelectScheme,
    setSchemeFilter,
    deleteCustomScheme,
    openCustomModalFromCurrent,
    closeCustomModal,
    handleModalPatternChange,
    handleModalPalletTypeChange,
    generateModalPointsFromFormula,
    setModalFormulaPreset,
    updateModalSnapSettings,
    snapAllModalRollsToEdges,
    resolveModalCollisions,
    deleteSelectedModalRoll,
    updateSelectedRollFromInputs,
    centerModalRolls,
    addRollToModalCanvas,
    clearModalRolls,
    updateModalPreview,
    saveCustomScheme,
    autoSelectBestScheme,
    triggerOptimalScheme,
    set3DCameraPreset,
    printCalculationCard
});
