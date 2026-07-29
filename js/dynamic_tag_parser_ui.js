import { app } from "../../scripts/app.js";

// --- CSS TEMPLATE STRING ---
const STYLES = /*css*/ `
    .dtm-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: rgba(0, 0, 0, 0.75); z-index: 10000; display: flex; align-items: center; justify-content: center; font-family: sans-serif; box-sizing: border-box; }
    .dtm-modal { background-color: #222226; border: 1px solid #44444a; border-radius: 8px; padding: 20px; width: 600px; max-width: 92vw; max-height: 85vh; display: flex; flex-direction: column; gap: 15px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8); color: #eee; box-sizing: border-box; }
    .dtm-header h3 { margin: 0 0 5px 0; color: #fff; }
    .dtm-header p { margin: 0; font-size: 12px; color: #aaa; }
    .dtm-list-container { overflow-y: auto; overflow-x: hidden; max-height: 50vh; display: flex; flex-direction: column; gap: 8px; padding-right: 5px; width: 100%; box-sizing: border-box; }
    .dtm-row { display: grid; grid-template-columns: 1.5fr 1fr 1.2fr 1.5fr 30px; gap: 8px; align-items: center; background-color: #2d2d32; padding: 8px; border-radius: 6px; border: 1px solid #3a3a40; width: 100%; box-sizing: border-box; }
    .dtm-input { background-color: #18181c; border: 1px solid #444; color: #fff; padding: 6px 8px; border-radius: 4px; font-size: 12px; box-sizing: border-box; min-width: 0; width: 100%; }
    .dtm-btn-remove { background-color: #cc3333; border: none; color: #fff; padding: 6px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .dtm-btn-add { background-color: #3a3a40; border: 1px solid #555; color: #fff; padding: 8px; border-radius: 4px; cursor: pointer; font-weight: bold; margin-top: 5px; width: 100%; box-sizing: border-box; }
    .dtm-footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px; }
    .dtm-btn-cancel { background-color: #444; border: none; color: #ccc; padding: 8px 16px; border-radius: 4px; cursor: pointer; }
    .dtm-btn-save { background-color: #2e7d32; border: none; color: #fff; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: bold; }
    @media (max-width: 650px) {
        .dtm-modal { padding: 15px; width: 95vw; }
        .dtm-row { grid-template-columns: 1fr 1fr 35px; grid-template-rows: auto auto auto; gap: 8px; }
        .dtm-row > *:nth-child(1) { grid-column: 1 / 3; grid-row: 1; }        
        .dtm-row > *:nth-child(2) { grid-column: 1 / 2; grid-row: 2; }
        .dtm-row > *:nth-child(3) { grid-column: 2 / 4; grid-row: 2; }
        .dtm-row > *:nth-child(4) { grid-column: 1 / 4; grid-row: 3; }
        .dtm-row > *:nth-child(5) { grid-column: 3 / 4; grid-row: 1; height: 100%; }
        .dtm-footer { flex-direction: column-reverse; gap: 8px; }
        .dtm-btn-cancel, .dtm-btn-save { width: 100%; padding: 12px; }
    }
    `;

// --- UTILITY FUNCTIONS ---

function injectStyles() {
    if (document.getElementById('dtm-styles')) return;
    const styleEl = document.createElement('style');
    styleEl.id = 'dtm-styles';
    styleEl.textContent = STYLES;
    document.head.appendChild(styleEl);
}

function createElement(tag, className, attributes = {}) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'textContent' || key === 'innerHTML') {
            el[key] = value;
        } else {
            el.setAttribute(key, value);
            if (key !== 'list') {
                try {
                    el[key] = value;
                } catch (e) { }
            }
        }
    });
    return el;
}

function hideWidget(widget) {
    widget.type = "hidden";
    widget.computeSize = () => [0, -4];
    widget.draw = () => { };
}

function getTagConfigs(node) {
    let currentConfigs = node.properties?.tags_config || [];
    if (!currentConfigs.length) {
        const configWidget = node.widgets?.find(w => w.name === "tags_config");
        try {
            currentConfigs = JSON.parse(configWidget?.value || "[]");
        } catch (e) {
            currentConfigs = [];
        }
    }
    return currentConfigs;
}

function getComfyUIComboLists() {
    const combos = {};
    if (typeof window.LiteGraph === "undefined" || !window.LiteGraph.registered_node_types) return combos;

    for (const nodeName in window.LiteGraph.registered_node_types) {
        const nodeData = window.LiteGraph.registered_node_types[nodeName].nodeData;
        if (!nodeData || !nodeData.input) continue;

        const allInputs = { ...(nodeData.input.required || {}), ...(nodeData.input.optional || {}) };
        for (const [inputName, config] of Object.entries(allInputs)) {
            if (Array.isArray(config[0]) && config[0].length > 0 && typeof config[0][0] === "string") {
                if (!combos[inputName]) {
                    combos[inputName] = [...config[0]];
                } else {
                    combos[inputName] = [...new Set([...combos[inputName], ...config[0]])];
                }
            }
        }
    }
    return combos;
}

// --- CORE LOGIC ---

function openTagManagerModal(node) {
    injectStyles();
    const currentConfigs = getTagConfigs(node);
    const comfyCombos = getComfyUIComboLists();

    const overlay = createElement("div", "dtm-overlay");
    const modal = createElement("div", "dtm-modal");

    // Header
    const header = createElement("div", "dtm-header", {
        innerHTML: `
            <h3>⚙️ Dynamic Tag Manager</h3>
            <p>Configure tags to extract values from text (e.g. <code>&lt;tag_name:value&gt;</code>).</p>
        `
    });
    modal.appendChild(header);

    // Datalist for "Type" input autocomplete
    const dataList = createElement("datalist", "", { id: "dtm-type-list" });
    const standardTypes = ["INT", "FLOAT", "STRING", "BOOLEAN", "MODEL", "CLIP", "VAE", "LATENT", "IMAGE", "CONDITIONING", "MASK"];
    const comboTypes = Object.keys(comfyCombos).sort();
    const allAvailableTypes = [...new Set([...standardTypes, ...comboTypes])];

    allAvailableTypes.forEach(t => {
        const opt = document.createElement("option");
        opt.value = t;
        dataList.appendChild(opt);
    });
    modal.appendChild(dataList);

    const listContainer = createElement("div", "dtm-list-container");

    const getNextCustomName = () => {
        const rows = Array.from(listContainer.children);
        const maxIndex = rows.reduce((max, row) => {
            const match = row.getConfig().name.match(/^custom(\d+)$/i);
            return match ? Math.max(max, parseInt(match[1], 10)) : max;
        }, 0);
        return `custom${maxIndex + 1}`;
    };

    const addRow = (config = {}) => {
        const row = createElement("div", "dtm-row");

        const tagName = config.name !== undefined ? config.name : getNextCustomName();
        const tagType = config.type || "INT";
        const tagMode = config.defaultMode || "fixed";

        let previousType = tagType;
        let previousMode = tagMode;
        let isDefaultManuallySet = config.default !== undefined;
        let tagDefault = config.default ?? "0";

        // Name
        const nameInput = createElement("input", "dtm-input", { type: "text", placeholder: "Tag Name", value: tagName });

        // Type
        const typeInput = createElement("input", "dtm-input", { type: "text", value: tagType, list: "dtm-type-list", placeholder: "Type (e.g. STRING)" });

        // Mode
        const modeSelect = createElement("select", "dtm-input");
        const modeOptions = [
            { val: "fixed", text: "Fixed" },
            { val: "random_range", text: "Random Range" },
            { val: "list_random", text: "Random List" },
            { val: "list_cycle", text: "Cycle List" }
        ];
        modeOptions.forEach(optData => {
            modeSelect.add(new Option(optData.text, optData.val, false, optData.val === tagMode));
        });

        // Dynamic Default Input Container
        const defaultContainer = createElement("div", "", { style: "width: 100%; min-width: 0; display: flex;" });
        let defaultInput;

        const updateDefaultUI = () => {
            defaultContainer.innerHTML = '';
            const currentType = typeInput.value.trim();
            const upperType = currentType.toUpperCase();
            const isCombo = comfyCombos.hasOwnProperty(currentType);

            const supportsRandomRange = !isCombo && (upperType === "INT" || upperType === "FLOAT");
            const hasRandomRangeOption = Array.from(modeSelect.options).some(o => o.value === "random_range");

            if (!supportsRandomRange && hasRandomRangeOption) {
                for (let i = 0; i < modeSelect.options.length; i++) {
                    if (modeSelect.options[i].value === "random_range") {
                        modeSelect.remove(i);
                        break;
                    }
                }
                if (modeSelect.value === "random_range" || !modeSelect.value) {
                    modeSelect.value = "fixed";
                }
            } else if (supportsRandomRange && !hasRandomRangeOption) {
                modeSelect.add(new Option("Random Range", "random_range"), 1);
            }

            const currentMode = modeSelect.value;
            const modeChanged = currentMode !== previousMode;
            const typeChanged = currentType !== previousType;

            // 1. Auto-derive default values when type/mode changes, or on fresh init
            if (modeChanged || typeChanged || (!isDefaultManuallySet && (tagDefault === "0" || tagDefault === ""))) {
                if (isCombo) {
                    const options = comfyCombos[currentType];
                    if (currentMode.startsWith("list_")) {
                        // Join all options for lists
                        tagDefault = options.join(", ");
                    } else if (currentMode === "fixed") {
                        // Revert to first option for fixed
                        tagDefault = options.length > 0 ? options[0] : "";
                    }
                } else {
                    // Smart standard fallbacks
                    if (currentMode === "random_range") {
                        tagDefault = "0, 10";
                    } else if (currentMode.startsWith("list_")) {
                        tagDefault = "1, 2, 3";
                    } else {
                        if (upperType === "FLOAT") tagDefault = "0.0";
                        else if (upperType === "BOOLEAN") tagDefault = "false";
                        else if (upperType === "STRING") tagDefault = "";
                        else if (upperType === "INT") tagDefault = "0";
                        else tagDefault = "";
                    }
                }
            }

            // Sync state history
            previousType = currentType;
            previousMode = currentMode;

            // 2. Render UI Element
            if (isCombo && currentMode === "fixed") {
                defaultInput = createElement("select", "dtm-input");
                const options = comfyCombos[currentType];

                // Ensure the value exists before selecting, otherwise retain as a custom option
                if (!options.includes(tagDefault) && tagDefault !== "") {
                    defaultInput.add(new Option(tagDefault, tagDefault, false, true));
                }

                options.forEach(optVal => {
                    defaultInput.add(new Option(optVal, optVal, false, optVal === tagDefault));
                });
            } else {
                defaultInput = createElement("input", "dtm-input", { type: "text", value: tagDefault });
                switch (currentMode) {
                    case "random_range": defaultInput.placeholder = "min, max (e.g. 1, 10)"; break;
                    case "list_random":
                    case "list_cycle": defaultInput.placeholder = "item1, item2, item3"; break;
                    default: defaultInput.placeholder = "Default Value";
                }
            }

            // Sync and flag as manually interacted when the user touches the field
            const markDirty = (e) => {
                tagDefault = e.target.value;
                isDefaultManuallySet = true;
            };
            defaultInput.addEventListener("change", markDirty);
            defaultInput.addEventListener("input", markDirty);

            defaultContainer.appendChild(defaultInput);
        };

        typeInput.addEventListener("change", updateDefaultUI);
        typeInput.addEventListener("input", updateDefaultUI);
        modeSelect.addEventListener("change", updateDefaultUI);
        updateDefaultUI(); // Init

        const removeBtn = createElement("button", "dtm-btn-remove", { textContent: "🗑️", title: "Delete Tag" });
        removeBtn.addEventListener("click", () => row.remove());

        row.append(nameInput, typeInput, modeSelect, defaultContainer, removeBtn);

        row.getConfig = () => ({
            name: nameInput.value.trim(),
            type: typeInput.value.trim(),
            defaultMode: modeSelect.value,
            default: defaultInput.value.trim()
        });

        listContainer.appendChild(row);
    };

    // Initialize configuration rows
    if (currentConfigs.length === 0) {
        addRow({ name: "custom1", type: "INT" });
    } else {
        currentConfigs.forEach(addRow);
    }
    modal.appendChild(listContainer);

    // Add Row Button
    const addRowBtn = createElement("button", "dtm-btn-add", { textContent: "➕ Add New Tag" });
    addRowBtn.addEventListener("click", () => addRow());
    modal.appendChild(addRowBtn);

    // Footer Actions
    const footer = createElement("div", "dtm-footer");

    const cancelBtn = createElement("button", "dtm-btn-cancel", { textContent: "Cancel" });
    cancelBtn.addEventListener("click", () => overlay.remove());

    const saveBtn = createElement("button", "dtm-btn-save", { textContent: "Save & Apply" });
    saveBtn.addEventListener("click", () => {
        const newConfigs = Array.from(listContainer.children)
            .map(row => row.getConfig())
            .filter(cfg => cfg.name);

        applyTagConfigsToNode(node, newConfigs);
        overlay.remove();
    });

    footer.append(cancelBtn, saveBtn);
    modal.appendChild(footer);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

function applyTagConfigsToNode(node, configs = []) {
    node.properties = node.properties || {};
    node.properties.tags_config = configs;

    const configWidget = node.widgets?.find(w => w.name === "tags_config");
    if (configWidget) {
        configWidget.value = JSON.stringify(configs);
    }

    const targetOutputCount = configs.length + 1;
    const comfyCombos = getComfyUIComboLists();

    while (node.outputs?.length > targetOutputCount) {
        node.removeOutput(node.outputs.length - 1);
    }

    configs.forEach((cfg, idx) => {
        const slotIdx = idx + 1;
        const slotName = `${cfg.name} (${cfg.type})`;

        const isCombo = comfyCombos.hasOwnProperty(cfg.type);
        const actualType = isCombo ? "COMBO" : cfg.type;

        if (node.outputs && slotIdx < node.outputs.length) {
            const output = node.outputs[slotIdx];
            output.name = slotName;
            output.type = actualType;
            output.extra_config = cfg;
        } else {
            node.addOutput(slotName, actualType);
            const lastIdx = node.outputs.length - 1;
            node.outputs[lastIdx].extra_config = cfg;
        }
    });

    const computed = node.computeSize();
    const defaultWidth = 240;
    node.setSize([Math.max(defaultWidth, computed[0]), computed[1]]);
    node.setDirtyCanvas(true, true);
}

// --- EXTENSION REGISTRATION ---

app.registerExtension({
    name: "CustomNode.DynamicTagParser",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "DynamicTagParser") return;

        const origOnNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function (...args) {
            origOnNodeCreated?.apply(this, args);

            this.properties = this.properties || {};

            let configWidget = this.widgets?.find(w => w.name === "tags_config") ||
                this.addWidget("hidden", "tags_config", "[]", null);

            hideWidget(configWidget);
            this.addWidget("button", "⚙️ Manage Dynamic Tags", null, () => openTagManagerModal(this));

            let configs = this.properties.tags_config;
            if (!configs && configWidget.value) {
                try { configs = JSON.parse(configWidget.value); } catch (e) { }
            }
            applyTagConfigsToNode(this, configs || []);
        };

        const origOnSerialize = nodeType.prototype.onSerialize;
        nodeType.prototype.onSerialize = function (info, ...args) {
            origOnSerialize?.apply(this, [info, ...args]);
            info.properties = info.properties || {};
            info.properties.tags_config = this.properties?.tags_config || [];
        };

        const origOnConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function (info, ...args) {
            origOnConfigure?.apply(this, [info, ...args]);

            const configWidget = this.widgets?.find(w => w.name === "tags_config");
            if (configWidget) hideWidget(configWidget);

            let configs = info?.properties?.tags_config;
            if (!configs && configWidget?.value) {
                try { configs = JSON.parse(configWidget.value); } catch (e) { }
            }

            if (configs) applyTagConfigsToNode(this, configs);
        };

        const origClone = nodeType.prototype.clone;
        nodeType.prototype.clone = function (...args) {
            const cloned = origClone?.apply(this, args);
            if (cloned) {
                const configs = JSON.parse(JSON.stringify(this.properties?.tags_config || []));
                applyTagConfigsToNode(cloned, configs);
            }
            return cloned;
        };
    }
});