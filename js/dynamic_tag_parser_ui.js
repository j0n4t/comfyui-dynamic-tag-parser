import { app } from "../../scripts/app.js";

function hideWidget(widget) {
    widget.type = "hidden";
    widget.computeSize = () => [0, -4];
    widget.draw = () => { };
}

function openTagManagerModal(node) {
    let currentConfigs = node.properties?.tags_config || [];
    if (!currentConfigs.length) {
        const configWidget = node.widgets?.find(w => w.name === "tags_config");
        try {
            currentConfigs = JSON.parse(configWidget?.value || "[]");
        } catch (e) {
            currentConfigs = [];
        }
    }

    const overlay = document.createElement("div");
    Object.assign(overlay.style, {
        position: "fixed",
        top: "0",
        left: "0",
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        zIndex: "10000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "sans-serif"
    });

    const modal = document.createElement("div");
    Object.assign(modal.style, {
        backgroundColor: "#222226",
        border: "1px solid #44444a",
        borderRadius: "8px",
        padding: "20px",
        width: "600px",
        maxWidth: "92vw",
        maxHeight: "85vh",
        display: "flex",
        flexDirection: "column",
        gap: "15px",
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.8)",
        color: "#eee"
    });

    // Header
    const header = document.createElement("div");
    header.innerHTML = `
        <h3 style="margin: 0 0 5px 0; color: #fff;">⚙️ Dynamic Tag Manager</h3>
        <p style="margin: 0; font-size: 12px; color: #aaa;">
            Configure tags to extract values from text (e.g. <code>&lt;tag_name:value&gt;</code>).
        </p>
    `;
    modal.appendChild(header);

    const listContainer = document.createElement("div");
    Object.assign(listContainer.style, {
        overflowY: "auto",
        maxHeight: "50vh",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        paddingRight: "5px"
    });

    const getNextCustomName = () => {
        const rows = Array.from(listContainer.children);
        let maxIndex = 0;

        rows.forEach(r => {
            const name = r.getConfig().name;
            const match = name.match(/^custom(\d+)$/i);
            if (match) {
                const idx = parseInt(match[1], 10);
                if (idx > maxIndex) maxIndex = idx;
            }
        });

        if (maxIndex === 0) {
            return `custom${rows.length + 1}`;
        }
        return `custom${maxIndex + 1}`;
    };

    const addRow = (config = {}) => {
        const row = document.createElement("div");
        Object.assign(row.style, {
            display: "grid",
            gridTemplateColumns: "2fr 1.5fr 1.5fr 40px",
            gap: "8px",
            alignItems: "center",
            backgroundColor: "#2d2d32",
            padding: "8px",
            borderRadius: "6px",
            border: "1px solid #3a3a40"
        });

        const tagName = config.name !== undefined ? config.name : getNextCustomName();
        const tagType = config.type || "INT";
        const tagDefault = config.default ?? "0";

        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.placeholder = "Tag Name";
        nameInput.value = tagName;
        Object.assign(nameInput.style, {
            backgroundColor: "#18181c",
            border: "1px solid #444",
            color: "#fff",
            padding: "6px 8px",
            borderRadius: "4px",
            fontSize: "12px"
        });

        const typeSelect = document.createElement("select");
        ["INT", "FLOAT", "STRING", "BOOLEAN"].forEach(t => {
            const opt = document.createElement("option");
            opt.value = t;
            opt.textContent = t;
            if (t === tagType) opt.selected = true;
            typeSelect.appendChild(opt);
        });
        Object.assign(typeSelect.style, {
            backgroundColor: "#18181c",
            border: "1px solid #444",
            color: "#fff",
            padding: "6px 8px",
            borderRadius: "4px",
            fontSize: "12px"
        });

        const defaultInput = document.createElement("input");
        defaultInput.type = "text";
        defaultInput.placeholder = "Default Value";
        defaultInput.value = tagDefault;
        Object.assign(defaultInput.style, {
            backgroundColor: "#18181c",
            border: "1px solid #444",
            color: "#fff",
            padding: "6px 8px",
            borderRadius: "4px",
            fontSize: "12px"
        });

        const removeBtn = document.createElement("button");
        removeBtn.textContent = "🗑️";
        removeBtn.title = "Delete Tag";
        Object.assign(removeBtn.style, {
            backgroundColor: "#cc3333",
            border: "none",
            color: "#fff",
            padding: "6px",
            borderRadius: "4px",
            cursor: "pointer"
        });
        removeBtn.onclick = () => row.remove();

        row.appendChild(nameInput);
        row.appendChild(typeSelect);
        row.appendChild(defaultInput);
        row.appendChild(removeBtn);

        row.getConfig = () => ({
            name: nameInput.value.trim(),
            type: typeSelect.value,
            default: defaultInput.value.trim()
        });

        listContainer.appendChild(row);
    };

    if (currentConfigs.length === 0) {
        addRow({ name: "custom1", type: "INT", default: "0" });
    } else {
        currentConfigs.forEach(c => addRow(c));
    }

    modal.appendChild(listContainer);

    const addRowBtn = document.createElement("button");
    addRowBtn.textContent = "➕ Add New Tag";
    Object.assign(addRowBtn.style, {
        backgroundColor: "#3a3a40",
        border: "1px solid #555",
        color: "#fff",
        padding: "8px",
        borderRadius: "4px",
        cursor: "pointer",
        fontWeight: "bold",
        marginTop: "5px"
    });
    addRowBtn.onclick = () => addRow();
    modal.appendChild(addRowBtn);

    // Modal Footer Controls
    const footer = document.createElement("div");
    Object.assign(footer.style, {
        display: "flex",
        justifyContent: "flex-end",
        gap: "10px",
        marginTop: "10px"
    });

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    Object.assign(cancelBtn.style, {
        backgroundColor: "#444",
        border: "none",
        color: "#ccc",
        padding: "8px 16px",
        borderRadius: "4px",
        cursor: "pointer"
    });
    cancelBtn.onclick = () => overlay.remove();

    const saveBtn = document.createElement("button");
    saveBtn.textContent = "Save & Apply";
    Object.assign(saveBtn.style, {
        backgroundColor: "#2e7d32",
        border: "none",
        color: "#fff",
        padding: "8px 16px",
        borderRadius: "4px",
        cursor: "pointer",
        fontWeight: "bold"
    });

    saveBtn.onclick = () => {
        const rows = Array.from(listContainer.children);
        const newConfigs = [];

        for (const r of rows) {
            const cfg = r.getConfig();
            if (cfg.name) newConfigs.push(cfg);
        }

        applyTagConfigsToNode(node, newConfigs);
        overlay.remove();
    };

    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);
    modal.appendChild(footer);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

function applyTagConfigsToNode(node, configs) {
    if (!configs) configs = [];

    node.properties = node.properties || {};
    node.properties.tags_config = configs;

    const configWidget = node.widgets?.find(w => w.name === "tags_config");
    if (configWidget) {
        configWidget.value = JSON.stringify(configs);
    }

    const targetOutputCount = configs.length + 1; // 1 slot for clean_string + dynamic slots

    // Prune excess dynamic slots
    while (node.outputs && node.outputs.length > targetOutputCount) {
        node.removeOutput(node.outputs.length - 1);
    }

    // Update existing slots or append new dynamic slots
    configs.forEach((cfg, idx) => {
        const slotIdx = idx + 1;
        const slotName = `${cfg.name} (${cfg.type})`;

        if (slotIdx < node.outputs.length) {
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
    node.setSize([
        Math.max(defaultWidth, computed[0]),
        computed[1]
    ]);

    node.setDirtyCanvas(true, true);
}

app.registerExtension({
    name: "CustomNode.DynamicTagParser",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "DynamicTagParser") return;

        const origOnNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            if (origOnNodeCreated) origOnNodeCreated.apply(this, arguments);

            const node = this;
            node.properties = node.properties || {};

            let configWidget = node.widgets?.find(w => w.name === "tags_config");
            if (!configWidget) {
                configWidget = node.addWidget("hidden", "tags_config", "[]", null);
            }
            hideWidget(configWidget);

            node.addWidget("button", "⚙️ Manage Dynamic Tags", null, () => {
                openTagManagerModal(node);
            });

            let configs = node.properties.tags_config;
            if (!configs && configWidget.value) {
                try { configs = JSON.parse(configWidget.value); } catch (e) { }
            }
            applyTagConfigsToNode(node, configs || []);
        };

        const origOnSerialize = nodeType.prototype.onSerialize;
        nodeType.prototype.onSerialize = function (info) {
            if (origOnSerialize) origOnSerialize.apply(this, arguments);
            info.properties = info.properties || {};
            info.properties.tags_config = this.properties?.tags_config || [];
        };

        const origOnConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function (info) {
            if (origOnConfigure) origOnConfigure.apply(this, arguments);

            const configWidget = this.widgets?.find(w => w.name === "tags_config");
            if (configWidget) hideWidget(configWidget);

            let configs = info?.properties?.tags_config;
            if (!configs && configWidget?.value) {
                try { configs = JSON.parse(configWidget.value); } catch (e) { }
            }

            if (configs) {
                applyTagConfigsToNode(this, configs);
            }
        };

        const origClone = nodeType.prototype.clone;
        nodeType.prototype.clone = function () {
            const cloned = origClone ? origClone.apply(this, arguments) : null;
            if (cloned) {
                const configs = JSON.parse(JSON.stringify(this.properties?.tags_config || []));
                applyTagConfigsToNode(cloned, configs);
            }
            return cloned;
        };
    }
});