/* Печатная карточка. На экране скрыта, в PDF остается только она. */
function fillPrintCard(calc) {
    if (!document.getElementById('printCard')) return;
    if (!calc) calc = calculateAll();
    const set = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    set('printLength', formatRollMeters(calc.lengthMeters) + ' пог. м');
    set('printWidth', state.rollWidth + ' мм');
    const layerNote = calc.layers > 1 ? ' × ' + calc.layers + ' сл.' : '';
    set('printThickness', state.thicknessMicrons + ' мкм' + layerNote);
    set('printDiameter', calc.D + ' мм');
    set('printArea', calc.areaSqM.toFixed(1) + ' м²');
    set('printNet', calc.netWeightKg.toFixed(2) + ' кг');
    set('printGross', calc.grossWeightKg.toFixed(2) + ' кг');

    const stepBlock = document.getElementById('printStepBlock');
    const fitText = piecesFitText(calc.lengthMeters, state.printStepMm, state.printStreams);
    if (stepBlock) stepBlock.hidden = !fitText;
    if (fitText) {
        const laneNote = state.printStreams > 1 ? ' × ' + state.printStreams : '';
        set('printStep', String(state.printStepMm) + ' мм' + laneNote);
        set('printPieces', fitText);
    }

    const pallet = PALLET_DIMENSIONS[state.palletType];
    set('printPalletType', pallet ? pallet.name : '');
    const perLayerLabel = document.getElementById('printRollsPerLayerLabel');
    if (perLayerLabel) {
        perLayerLabel.textContent = (state.orientation === 'horizontal' && state.horizStackType === 'pyramid')
            ? 'В нижнем ярусе'
            : 'В ярусе';
    }
    set('printRollsPerLayer', calc.rollsPerTier + ' шт');
    set('printTiers', String(state.tiers));
    set('printTotalRolls', calc.totalRollsOnPallet + ' шт');

    const pack = packingLines(calc);
    set('printPackPallets', pack.pallets);
    set('printPackInterlayers', pack.interlayers);
    set('printPackStretch', pack.stretch);
    set('printPackCores', pack.cores);
}

function printCalculationCard() {
    fillPrintCard();
    window.print();
}

window.addEventListener('beforeprint', () => fillPrintCard());
