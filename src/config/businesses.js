const businesses = [
    {
        id: "cellulaire-care",

        name: "Cellulaire Care",

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


        // ========================================
        // AI CONFIGURATION
        // ========================================

        ai: {

            tone:
                "friendly, professional and conversational",

            replyLength:
                "short",

            leadCapture: {

                enabled: true,

                requiredFields: [
                    "name",
                    "phone"
                ],

                askOneAtATime: true,

                instructions:
                    "When a customer clearly wants to proceed with a repair, visit the store, book, or be contacted, collect the required contact information and save the lead.",

                metadataFields: [
                    "device",
                    "service",
                    "quoted_price",
                    "duration",
                    "warranty",
                    "intent"
                ]
            }
        },


        // ========================================
        // BUSINESS CAPABILITIES
        // ========================================

        capabilities: [
            "lookup_service_info"
        ]
    }
];


function getBusinessByFacebookPageId(
    pageId
) {

    return businesses.find(
        business =>
            business.connections
                ?.facebook
                ?.pageId === pageId
    );
}


module.exports = {
    businesses,
    getBusinessByFacebookPageId
};