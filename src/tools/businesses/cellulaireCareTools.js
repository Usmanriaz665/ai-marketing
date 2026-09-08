const repairs =
    require("../../data/businesses/cellulaire-care/repairs_complete_latest.json");


// ========================================
// NORMALIZE TEXT
// ========================================

function normalizeText(value = "") {
    return String(value)
        .toLowerCase()
        .trim()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ");
}


function normalizeCompact(value = "") {
    return normalizeText(value)
        .replace(/\s+/g, "");
}


// ========================================
// DETECT WHETHER OBJECT LOOKS LIKE
// A DEVICE REPAIR RECORD
// ========================================

function looksLikeRepairRecord(value) {

    if (
        !value ||
        typeof value !== "object" ||
        Array.isArray(value)
    ) {
        return false;
    }

    const knownRepairKeys = [
        "screen",
        "back_glass",
        "ear_speaker",
        "battery",
        "charging_port",
        "rear_camera",
        "front_camera",
        "camera_lens",
        "loud_speaker",
        "mic",
        "volume_keys_power_button",
        "data_recovery_backup",
        "water_general_diagnosis"
    ];

    return knownRepairKeys.some(
        key =>
            Object.prototype.hasOwnProperty.call(
                value,
                key
            )
    );
}


// ========================================
// RECURSIVELY FIND DEVICE
// ========================================

// ========================================
// COLLECT ALL DEVICES FROM CATALOG
// ========================================

function collectDevices(
    node,
    path = [],
    results = []
) {

    if (
        !node ||
        typeof node !== "object" ||
        Array.isArray(node)
    ) {
        return results;
    }


    for (
        const [key, value]
        of Object.entries(node)
    ) {

        if (looksLikeRepairRecord(value)) {

            results.push({
                deviceName: key,
                repairs: value,
                path: [
                    ...path,
                    key
                ]
            });

            continue;
        }


        if (
            value &&
            typeof value === "object"
        ) {

            collectDevices(
                value,
                [
                    ...path,
                    key
                ],
                results
            );
        }
    }


    return results;
}


// Build once when server starts
const catalogDevices =
    collectDevices(repairs);

console.log(
    `📱 Loaded ${catalogDevices.length} repair devices`
);


// ========================================
// CREATE DEVICE ALIASES
// ========================================

function getDeviceAliases(deviceName) {

    const normalized =
        normalizeText(deviceName);

    const compact =
        normalized.replace(/\s+/g, "");

    const aliases =
        new Set([
            normalized,
            compact
        ]);


    // ----------------------------------------
    // iPhone aliases
    // ----------------------------------------

    if (normalized.startsWith("iphone ")) {

        const model =
            normalized.replace(
                /^iphone\s+/,
                ""
            );

        const compactModel =
            model.replace(/\s+/g, "");


        aliases.add(model);
        aliases.add(compactModel);

        aliases.add(
            `iphone${compactModel}`
        );


        // 13 Pro Max -> 13pm
        if (
            model.endsWith(" pro max")
        ) {

            const number =
                model.replace(
                    /\s+pro\s+max$/,
                    ""
                );

            aliases.add(
                `${number}pm`
            );

            aliases.add(
                `${number}promax`
            );

            aliases.add(
                `iphone${number}pm`
            );
        }


        // 13 Pro -> 13p
        if (
            model.endsWith(" pro") &&
            !model.endsWith(" pro max")
        ) {

            const number =
                model.replace(
                    /\s+pro$/,
                    ""
                );

            aliases.add(
                `${number}p`
            );

            aliases.add(
                `${number}pro`
            );

            aliases.add(
                `iphone${number}p`
            );
        }


        // 13 Plus -> 13+
        if (
            model.endsWith(" plus")
        ) {

            const number =
                model.replace(
                    /\s+plus$/,
                    ""
                );

            aliases.add(
                `${number}+`
            );

            aliases.add(
                `${number}plus`
            );

            aliases.add(
                `iphone${number}+`
            );
        }
    }


    return Array.from(aliases);
}


// ========================================
// FIND DEVICE
// ========================================

function findDevice(device = "") {

    const input =
        normalizeText(device);

    const compactInput =
        input.replace(/\s+/g, "");


    if (!compactInput) {
        return null;
    }


    // ========================================
    // 1. EXACT MATCH
    // ========================================

    for (const item of catalogDevices) {

        const aliases =
            getDeviceAliases(
                item.deviceName
            );


        const exactMatch =
            aliases.some(alias => {

                const compactAlias =
                    normalizeText(alias)
                        .replace(/\s+/g, "");

                return (
                    compactAlias ===
                    compactInput
                );
            });


        if (exactMatch) {

            return {
                ...item,
                matchType: "exact"
            };
        }
    }


    // ========================================
    // 2. UNIQUE PARTIAL MATCH
    // ========================================

    const matches = [];


    for (const item of catalogDevices) {

        const aliases =
            getDeviceAliases(
                item.deviceName
            );


        const matched =
            aliases.some(alias => {

                const compactAlias =
                    normalizeText(alias)
                        .replace(/\s+/g, "");

                // Avoid dangerously short matching
                if (
                    compactAlias.length < 3 ||
                    compactInput.length < 3
                ) {
                    return false;
                }

                return (
                    compactAlias.includes(
                        compactInput
                    ) ||
                    compactInput.includes(
                        compactAlias
                    )
                );
            });


        if (matched) {
            matches.push(item);
        }
    }


    // Only accept partial match when
    // exactly one catalog device matches.
    if (matches.length === 1) {

        return {
            ...matches[0],
            matchType: "partial"
        };
    }


    // Multiple possible devices = don't guess
    if (matches.length > 1) {

        return {
            ambiguous: true,

            candidates:
                matches
                    .slice(0, 5)
                    .map(
                        item =>
                            item.deviceName
                    )
        };
    }


    return null;
}


// ========================================
// SERVICE MATCHING
// ========================================

function findService(service = "") {

    const input =
        normalizeText(service);


    const aliases = {

        screen: [
            "screen",
            "screen repair",
            "screen replacement",
            "display",
            "display repair",
            "lcd",
            "lcd repair",
            "broken screen",
            "cracked screen"
        ],

        back_glass: [
            "back glass",
            "backglass",
            "rear glass",
            "back glass repair",
            "back repair"
        ],

        ear_speaker: [
            "ear speaker",
            "earpiece",
            "earpiece speaker"
        ],

        battery: [
            "battery",
            "battery replacement",
            "battery repair",
            "replace battery"
        ],

        charging_port: [
            "charging port",
            "charge port",
            "charger port",
            "charging connector",
            "charging port repair"
        ],

        rear_camera: [
            "rear camera",
            "back camera",
            "main camera"
        ],

        front_camera: [
            "front camera",
            "selfie camera"
        ],

        camera_lens: [
            "camera lens",
            "camera glass",
            "lens"
        ],

        loud_speaker: [
            "loud speaker",
            "loudspeaker",
            "bottom speaker",
            "speaker"
        ],

        mic: [
            "mic",
            "microphone"
        ],

        volume_keys_power_button: [
            "volume keys",
            "volume button",
            "volume buttons",
            "power button",
            "power key",
            "side button"
        ],

        data_recovery_backup: [
            "data recovery",
            "data backup",
            "backup",
            "recover data"
        ],

        water_general_diagnosis: [
            "water damage",
            "water diagnosis",
            "water damage diagnosis",
            "diagnosis",
            "diagnostic",
            "general diagnosis"
        ]
    };


    for (
        const [serviceKey, names]
        of Object.entries(aliases)
    ) {

        if (
            names.some(
                name =>
                    input === name ||
                    input.includes(name)
            )
        ) {
            return serviceKey;
        }
    }


    return null;
}


// ========================================
// LOOKUP SERVICE
// ========================================

async function lookupServiceInfo(args = {}) {

    const {
        service,
        device
    } = args;


    console.log(
        "🔎 Looking up repair:",
        {
            device,
            service
        }
    );


    // ========================================
    // FIND DEVICE ANYWHERE IN JSON
    // ========================================

    const deviceResult =
        findDevice(device);


    if (!deviceResult) {

        console.log(
            "❌ Device not found:",
            device
        );

        return {
            success: true,
            found: false,
            reason: "device_not_found",
            requestedDevice:
                device || null
        };
    }


    if (deviceResult.ambiguous) {

        console.log(
            "⚠️ Ambiguous device:",
            device,
            deviceResult.candidates
        );

        return {
            success: true,
            found: false,
            reason: "ambiguous_device",
            requestedDevice:
                device || null,
            candidates:
                deviceResult.candidates,
            message:
                "More than one device matches. Ask the customer which exact model they have."
        };
    }


    console.log(
        `✅ Device found: ${deviceResult.deviceName} (${deviceResult.matchType})`
    );

    console.log(
        "📂 Catalog path:",
        deviceResult.path.join(" > ")
    );


    // ========================================
    // FIND SERVICE
    // ========================================

    const serviceKey =
        findService(service);


    if (!serviceKey) {

        console.log(
            "❌ Service not recognized:",
            service
        );

        return {
            success: true,
            found: false,
            reason:
                "service_not_recognized",

            device:
                deviceResult.deviceName,

            requestedService:
                service || null
        };
    }


    const repair =
        deviceResult.repairs[
        serviceKey
        ];


    // ========================================
    // NO DATA
    // ========================================

    if (!repair) {

        console.log(
            "❌ Repair data unavailable:",
            deviceResult.deviceName,
            serviceKey
        );

        return {
            success: true,
            found: false,
            reason:
                "repair_data_unavailable",

            device:
                deviceResult.deviceName,

            service:
                serviceKey
        };
    }


    // ========================================
    // SUCCESS
    // ========================================

    const result = {

        success: true,
        found: true,

        device:
            deviceResult.deviceName,

        service:
            serviceKey,

        price:
            repair.price ?? null,

        currency:
            repair.currency || "CAD",

        duration:
            repair.duration ?? null,

        warranty:
            repair.warranty ?? null,

        free:
            repair.free === true
    };


    console.log(
        "✅ Repair found:",
        result
    );


    return result;
}


module.exports = {
    lookupServiceInfo
};