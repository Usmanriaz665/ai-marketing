const {
    getBusinessTool
} = require("../tools/toolRegistry");

async function executeBusinessTool({
    businessId,
    toolName,
    arguments: args
}) {

    const tool =
        getBusinessTool(
            businessId,
            toolName
        );

    if (!tool) {
        return {
            success: false,
            error:
                `Tool ${toolName} is not available for business ${businessId}`
        };
    }

    try {

        return await tool(args);

    }
    catch (error) {

        console.error(
            "❌ Business tool failed:",
            error
        );

        return {
            success: false,
            error:
                "Business tool execution failed"
        };
    }
}

module.exports = {
    executeBusinessTool
};