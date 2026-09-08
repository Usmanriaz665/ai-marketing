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

function findDeviceRecursive(
    node,
    requestedDevice,
    path = []
) {

    if (
        !node ||
        typeof node !== "object"
    ) {
        return null;
    }

    const requested =
        normalizeCompact(requestedDevice);


    for (
        const [key, value]
        of Object.entries(node)
    ) {

        const normalizedKey =
            normalizeCompact(key);


        if (
            normalizedKey === requested &&
            looksLikeRepairRecord(value)
        ) {

            return {
                deviceName: key,
                repairs: value,
                path: [
                    ...path,
                    key
                ]
            };
        }


        if (
            value &&
            typeof value === "object"
        ) {

            const found =
                findDeviceRecursive(
                    value,
                    requestedDevice,
                    [
                        ...path,
                        key
                    ]
                );

            if (found) {
                return found;
            }
        }
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
        findDeviceRecursive(
            repairs,
            device
        );


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


    console.log(
        "✅ Device found:",
        deviceResult.deviceName
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