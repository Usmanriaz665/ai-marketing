const {
    getBusinessByFacebookPageId
} = require("../config/businesses");


function resolveFacebookBusiness(pageId) {

    const business =
        getBusinessByFacebookPageId(pageId);

    if (!business) {

        console.warn(
            `⚠️ No business configured for Facebook Page ${pageId}`
        );

        return null;
    }


    console.log(
        `🏢 Business resolved: ${business.name}`
    );

    return business;
}


module.exports = {
    resolveFacebookBusiness
};