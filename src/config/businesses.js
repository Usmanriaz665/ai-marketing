const businesses = [
    {
        id: "cellulaire-care",

        name:
            "Cellulaire Care",

        connections: {
            facebook: {
                pageId:
                    process.env.FACEBOOK_PAGE_ID
            }
        },

        profile: {
            industry:
                "cellphone_repair",

            description:
                "Cellphone repair and related services.",

            languages: [
                "fr",
                "en"
            ],

            defaultLanguage:
                "fr"
        },

        capabilities: [
            "lookup_service_info"
        ]
    }
];


function getBusinessByFacebookPageId(pageId) {

    return businesses.find(
        business =>
            business.connections.facebook.pageId === pageId
    );
}


module.exports = {
    businesses,
    getBusinessByFacebookPageId
};