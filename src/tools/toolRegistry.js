const {
    lookupServiceInfo
} = require("./businesses/cellulaireCareTools");

const toolsByBusiness = {
    "cellulaire-care": {
        lookup_service_info: lookupServiceInfo
    }
};

function getBusinessTool(
    businessId,
    toolName
) {

    const businessTools =
        toolsByBusiness[businessId];

    if (!businessTools) {
        return null;
    }

    return businessTools[toolName] || null;
}

module.exports = {
    getBusinessTool
};