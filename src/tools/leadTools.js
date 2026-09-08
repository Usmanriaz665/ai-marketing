const {
    saveLead
} = require("../services/leadService");


async function saveLeadTool({
    business,
    platform,
    customerId,
    args
}) {

    const result =
        await saveLead({

            businessId:
                business.id,

            platform,

            platformCustomerId:
                customerId,

            name:
                args.name || null,

            phone:
                args.phone || null,

            email:
                args.email || null,

            summary:
                args.summary || null,

            metadata:
                args.metadata || {}
        });


    return result;
}


module.exports = {
    saveLeadTool
};