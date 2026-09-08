// ========================================
// BUSINESS CONFIGURATION
// ========================================

const businesses = [

    // ========================================
    // CELLULAIRE CARE
    // ========================================

    {
        id: "cellulaire-care",

        name: "Cellulaire Care",


        // ========================================
        // PLATFORM CONNECTIONS
        // ========================================

        connections: {

            facebook: {

                pageId:
                    process.env.FACEBOOK_PAGE_ID
            }
        },


        // ========================================
        // BUSINESS PROFILE
        // ========================================

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


            // ========================================
            // LEAD CAPTURE
            // ========================================

            leadCapture: {

                enabled:
                    true,

                requiredFields: [
                    "name",
                    "phone"
                ],

                askOneAtATime:
                    true,

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
            },


            // ========================================
            // HUMAN HANDOFF
            // ========================================

            humanHandoff: {

                enabled:
                    true,

                instructions:
                    "Use human handoff when the customer explicitly asks to speak with a person, has a serious complaint, or the request requires assistance that the AI cannot reliably provide."
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


// ========================================
// FIND BUSINESS BY FACEBOOK PAGE
// ========================================

function getBusinessByFacebookPageId(
    pageId
) {

    if (!pageId) {
        return null;
    }


    return (
        businesses.find(
            business =>
                business.connections
                    ?.facebook
                    ?.pageId === pageId
        ) || null
    );
}


// ========================================
// FIND BUSINESS BY ID
// ========================================

function getBusinessById(
    businessId
) {

    if (!businessId) {
        return null;
    }


    return (
        businesses.find(
            business =>
                business.id === businessId
        ) || null
    );
}


// ========================================
// EXPORTS
// ========================================

module.exports = {
    businesses,
    getBusinessByFacebookPageId,
    getBusinessById
};