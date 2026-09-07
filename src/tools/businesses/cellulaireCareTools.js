async function lookupServiceInfo(args) {

    const {
        service,
        device
    } = args;

    return {
        success: true,
        message:
            `Service information requested for ${service || "unknown service"} on ${device || "unknown device"}.`
    };
}

module.exports = {
    lookupServiceInfo
};