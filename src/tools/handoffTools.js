const {
    createHandoff
} = require(
    "../services/handoffService"
);


async function requestHumanHandoffTool({
    business,
    platform,
    customerId,
    args
}) {

    return await createHandoff({
        businessId:
            business.id,

        platform,

        platformCustomerId:
            customerId,

        reason:
            args.reason || null,

        summary:
            args.summary || null,

        priority:
            args.priority || "normal"
    });
}


module.exports = {
    requestHumanHandoffTool
};