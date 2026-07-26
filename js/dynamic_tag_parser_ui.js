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
            el[key] = value; // Apply directly for input values, types, etc.
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

// --- CORE LOGIC ---

function openTagManagerModal(node) {
    injectStyles();
    const currentConfigs = getTagConfigs(node);

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

    // List Container
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
        const tagDefault = config.default ?? "0";

        // Inputs
        const nameInput = createElement("input", "dtm-input", { type: "text", placeholder: "Tag Name", value: tagName });
        const defaultInput = createElement("input", "dtm-input", { type: "text", value: tagDefault });

        // Selectors
        const typeSelect = createElement("select", "dtm-input");
        ["INT", "FLOAT", "STRING", "BOOLEAN"].forEach(t => {
            typeSelect.add(new Option(t, t, false, t === tagType));
        });

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

        // Event Listeners
        const updatePlaceholder = () => {
            switch (modeSelect.value) {
                case "random_range": defaultInput.placeholder = "min, max (e.g. 1, 10)"; break;
                case "list_random":
                case "list_cycle": defaultInput.placeholder = "item1, item2, item3"; break;
                default: defaultInput.placeholder = "Default Value";
            }
        };
        modeSelect.addEventListener("change", updatePlaceholder);
        updatePlaceholder();

        const removeBtn = createElement("button", "dtm-btn-remove", { textContent: "🗑️", title: "Delete Tag" });
        removeBtn.addEventListener("click", () => row.remove());

        // Append to row
        row.append(nameInput, typeSelect, modeSelect, defaultInput, removeBtn);

        // State extraction helper bound to the row
        row.getConfig = () => ({
            name: nameInput.value.trim(),
            type: typeSelect.value,
            defaultMode: modeSelect.value,
            default: defaultInput.value.trim()
        });

        listContainer.appendChild(row);
    };

    // Initialize configuration rows
    if (currentConfigs.length === 0) {
        addRow({ name: "custom1", type: "INT", default: "0" });
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

    const targetOutputCount = configs.length + 1; // 1 slot for clean_string + dynamic slots

    // Prune excess dynamic slots
    while (node.outputs?.length > targetOutputCount) {
        node.removeOutput(node.outputs.length - 1);
    }

    // Update existing slots or append new dynamic slots
    configs.forEach((cfg, idx) => {
        const slotIdx = idx + 1;
        const slotName = `${cfg.name} (${cfg.type})`;

        if (node.outputs && slotIdx < node.outputs.length) {
            const output = node.outputs[slotIdx];
            output.name = slotName;
            output.type = cfg.type;
            output.extra_config = cfg;
        } else {
            node.addOutput(slotName, cfg.type);
            const lastIdx = node.outputs.length - 1;
            node.outputs[lastIdx].extra_config = cfg;
        }
    });

    // Recalculate node dimensions back to compact size
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