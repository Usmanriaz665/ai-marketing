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


// ========================================
// FIND DEVICE
// ========================================

function findDevice(device = "") {

    const input =
        normalizeText(device)
            .replace(/\s+/g, "");

    if (!input) {
        return null;
    }

    const deviceNames =
        Object.keys(repairs);

    for (const deviceName of deviceNames) {

        const normalizedDevice =
            normalizeText(deviceName)
                .replace(/\s+/g, "");

        if (normalizedDevice === input) {
            return deviceName;
        }
    }

    return null;
}


// ========================================
// FIND SERVICE
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
            "side button",
            "volume keys power button"
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
            names.some(name =>
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
// LOOKUP SERVICE INFORMATION
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


    // ----------------------------------------
    // Find device
    // ----------------------------------------

    const deviceName =
        findDevice(device);


    if (!deviceName) {

        console.log(
            "❌ Device not found:",
            device
        );

        return {
            success: true,
            found: false,
            reason: "device_not_found",
            requestedDevice: device || null,
            message:
                "The requested device was not found in the repair catalog."
        };
    }


    // ----------------------------------------
    // Find service
    // ----------------------------------------

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
            reason: "service_not_recognized",
            device: deviceName,
            requestedService: service || null,
            message:
                "The requested repair service could not be identified."
        };
    }


    // ----------------------------------------
    // Get device repairs
    // ----------------------------------------

    const deviceRepairs =
        repairs[deviceName];


    if (!deviceRepairs) {

        return {
            success: true,
            found: false,
            reason: "device_data_unavailable",
            device: deviceName
        };
    }


    // ----------------------------------------
    // Get specific repair
    // ----------------------------------------

    const repair =
        deviceRepairs[serviceKey];


    if (!repair) {

        console.log(
            "❌ Repair data unavailable:",
            deviceName,
            serviceKey
        );

        return {
            success: true,
            found: false,
            reason: "repair_data_unavailable",
            device: deviceName,
            service: serviceKey,
            message:
                "Repair information is not currently available for this device and service."
        };
    }


    // ----------------------------------------
    // Successful result
    // ----------------------------------------

    const result = {

        success: true,
        found: true,

        device:
            deviceName,

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