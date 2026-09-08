const OpenAI = require("openai");

const {
    saveLeadTool
} = require("../tools/leadTools");

const {
    getConversation,
    addMessage,
    completeConversation
} = require("./conversationService");

const {
    executeBusinessTool
} = require("./toolService");


const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});


// ========================================
// GENERATE AI REPLY
// ========================================

async function generateAIReply({
    business,
    platform,
    customerId,
    text,
    messageId = null
}) {

    // ========================================
    // SAVE CUSTOMER MESSAGE
    // ========================================

    const messageResult =
        await addMessage(
            business.id,
            platform,
            customerId,
            "user",
            text,
            messageId
        );


    // Prevent duplicate Facebook webhook
    // deliveries from generating duplicate replies.
    if (messageResult?.duplicate) {

        console.log(
            `🔁 Skipping AI reply for duplicate message: ${messageId}`
        );

        return null;
    }


    // ========================================
    // LOAD CONVERSATION HISTORY
    // ========================================

    const history =
        await getConversation(
            business.id,
            platform,
            customerId
        );


    console.log(
        "🧠 Conversation history:",
        JSON.stringify(
            history,
            null,
            2
        )
    );


    // ========================================
    // SYSTEM PROMPT
    // ========================================

    const systemPrompt = `
You are an AI customer service and sales assistant
for ${business.name}.

Business information:
${business.profile.description}

Industry:
${business.profile.industry}

Your responsibilities:

- Respond naturally to customers.
- Understand what the customer wants.
- Ask relevant follow-up questions when information is missing.
- Help convert genuine inquiries into customers.
- Keep replies concise because this is instant messaging.
- Respond in the language used by the customer.
- Never invent prices, services, availability, policies, or business information.
- When the customer asks about a service, price, repair, product, or business-specific information, use the available business tools.
- If the available business tools do not contain the required information, explain that a team member can assist.
- Do not mention OpenAI.

BUSINESS TOOL RULES:

- When a business tool returns found=true, use the exact information returned by the tool.
- Never change, estimate, round, or invent a price.
- If duration is provided, tell the customer the duration when relevant.
- If warranty is provided, tell the customer the warranty when relevant.
- If free=true, clearly tell the customer the service is free.
- If found=false, never guess the price or service information.
- If information is unavailable, explain that a team member can assist.

DEVICE MATCHING:

- Customers may use abbreviations or incomplete device names.
- Use business tools to resolve device and service information.
- If a tool returns reason="ambiguous_device", do not choose a device yourself.
- Ask the customer a short follow-up question to identify the exact model.
- If a tool returns candidates, use those candidates to help clarify the model.
- Never invent a device match.

CONVERSATION CONTEXT:

- Use information the customer already provided earlier in the conversation.
- Do not ask again for information that is already clearly known.
- Pay particular attention to the most recent messages when determining what device, service, product, or request the customer is referring to.
- If the customer says "it", "this", "that", "come today", "do it", or similar phrases, use recent conversation context to understand what they mean.
- If the recent context clearly identifies the device and service, do not ask for them again.
- If the context is genuinely ambiguous, ask a short clarification question.

LEAD CAPTURE:

Your goal is to help genuine customers move toward completing
their purchase, booking, visit, or service request.

When a customer shows clear intent to proceed, such as:
- "I want to do it"
- "Can I come today?"
- "I want to come today"
- "I want to book"
- "Where can I bring it?"
- "Can someone contact me?"
- or similar buying intent

begin collecting the information needed for a lead.

Ask for missing information naturally, one question at a time.

For this business, normally collect the customer's name and
phone number when appropriate.

Do not repeatedly ask for information the customer already provided.

Once sufficient contact information has been provided, call
save_lead.

Use metadata to preserve useful business-specific information
already learned during the conversation.

For a cellphone repair lead, metadata can contain fields such as:
device, service, quoted_price, duration, warranty, and intent.

Never invent customer information.

After save_lead succeeds, confirm naturally that the customer's
information has been received.

Do not tell the customer about databases, functions, tools,
metadata, or internal systems.

MESSAGING STYLE:

- Facebook Messenger does not support Markdown formatting.
- Never use Markdown.
- Never use asterisks for bold text.
- Do not use headings or tables in customer replies.
- Write clean plain-text messages suitable for Messenger.
- Keep replies short, friendly, natural, and conversational.
`;


    // ========================================
    // AVAILABLE TOOLS
    // ========================================

    const tools = [];


    // ========================================
    // BUSINESS-SPECIFIC TOOL
    // ========================================

    if (
        business.capabilities?.includes(
            "lookup_service_info"
        )
    ) {

        tools.push({
            type: "function",

            function: {
                name: "lookup_service_info",

                description:
                    "Look up business-specific service information such as service details, repair information, or pricing when available.",

                parameters: {
                    type: "object",

                    properties: {

                        service: {
                            type: "string",
                            description:
                                "The service requested by the customer, for example screen repair or battery replacement."
                        },

                        device: {
                            type: "string",
                            description:
                                "The device, product, or item involved, for example iPhone 13."
                        }
                    },

                    required: []
                }
            }
        });
    }


    // ========================================
    // GENERIC LEAD TOOL
    // ========================================

    tools.push({
        type: "function",

        function: {
            name: "save_lead",

            description:
                "Save a qualified sales lead after the customer shows clear interest in buying, booking, visiting, or proceeding and sufficient contact information has been collected.",

            parameters: {
                type: "object",

                properties: {

                    name: {
                        type: "string",
                        description:
                            "Customer name if provided."
                    },

                    phone: {
                        type: "string",
                        description:
                            "Customer phone number if provided."
                    },

                    email: {
                        type: "string",
                        description:
                            "Customer email address if provided."
                    },

                    summary: {
                        type: "string",
                        description:
                            "Short summary of what the customer wants."
                    },

                    metadata: {
                        type: "object",
                        description:
                            "Business-specific structured information about the lead.",
                        additionalProperties: true
                    }
                },

                required: [
                    "summary"
                ]
            }
        }
    });


    // ========================================
    // BUILD AI MESSAGE HISTORY
    // ========================================

    const messages = [
        {
            role: "system",
            content: systemPrompt
        },
        ...history
    ];


    // ========================================
    // MULTI-ROUND AI TOOL LOOP
    // ========================================

    const MAX_TOOL_ROUNDS = 5;

let assistantMessage = null;
let shouldCompleteConversation = false;


    for (
        let round = 1;
        round <= MAX_TOOL_ROUNDS;
        round++
    ) {

        console.log(
            `🤖 AI round ${round}`
        );


        // ========================================
        // CALL OPENAI
        // ========================================

        const response =
            await openai.chat.completions.create({

                model:
                    process.env.OPENAI_MESSAGING_MODEL ||
                    "gpt-5.6-terra",

                reasoning_effort: "none",

                messages,

                tools,

                tool_choice: "auto"
            });


        assistantMessage =
            response.choices[0].message;


        // ========================================
        // CHECK FOR TOOL CALLS
        // ========================================

        const hasToolCalls =
            Array.isArray(
                assistantMessage.tool_calls
            ) &&
            assistantMessage.tool_calls.length > 0;


        // ========================================
        // NO TOOLS = FINAL RESPONSE
        // ========================================

        if (!hasToolCalls) {

            console.log(
                "✅ AI returned final response"
            );

            break;
        }


        console.log(
            `🔧 AI requested ${assistantMessage.tool_calls.length} tool call(s)`
        );


        // IMPORTANT:
        // Add assistant tool-call message
        // before returning tool results.
        messages.push(
            assistantMessage
        );


        // ========================================
        // EXECUTE ALL REQUESTED TOOLS
        // ========================================

        for (
            const toolCall
            of assistantMessage.tool_calls
        ) {

            if (
                toolCall.type !== "function"
            ) {
                continue;
            }


            const toolName =
                toolCall.function.name;


            // ========================================
            // PARSE TOOL ARGUMENTS
            // ========================================

            let args = {};


            try {

                args =
                    JSON.parse(
                        toolCall.function.arguments ||
                        "{}"
                    );

            }
            catch (error) {

                console.error(
                    "❌ Invalid tool arguments:",
                    toolCall.function.arguments
                );

                args = {};
            }


            console.log(
                "🔧 Executing tool:",
                toolName,
                args
            );


            let result;


            // ========================================
            // GENERIC LEAD TOOL
            // ========================================

if (
    toolName === "save_lead"
) {

    console.log(
        "🎯 Executing lead capture:",
        args
    );


    result =
        await saveLeadTool({
            business,
            platform,
            customerId,
            args
        });


    // Mark the current conversation for
    // completion only if the lead was
    // successfully saved.
    if (
        result?.success === true
    ) {

        shouldCompleteConversation = true;

        console.log(
            "🎯 Lead saved successfully. Conversation will be completed after the final AI reply."
        );
    }

}


            // ========================================
            // BUSINESS-SPECIFIC TOOLS
            // ========================================

            else {

                result =
                    await executeBusinessTool({
                        businessId:
                            business.id,

                        toolName,

                        arguments:
                            args
                    });
            }


            console.log(
                "🔧 Tool result:",
                result
            );


            // ========================================
            // RETURN TOOL RESULT TO AI
            // ========================================

            messages.push({
                role: "tool",

                tool_call_id:
                    toolCall.id,

                content:
                    JSON.stringify(result)
            });
        }


        // ========================================
        // MAXIMUM TOOL ROUND PROTECTION
        // ========================================

        if (
            round === MAX_TOOL_ROUNDS
        ) {

            console.error(
                "❌ Maximum AI tool rounds reached"
            );

            assistantMessage = {
                role: "assistant",
                content:
                    "A team member can assist you with that request."
            };
        }
    }


    // ========================================
    // FINAL TEXT RESPONSE
    // ========================================

    const reply =
        assistantMessage?.content?.trim();


    if (!reply) {

        console.error(
            "❌ AI returned no final text response"
        );

        return (
            "A team member can assist you with that request."
        );
    }


    // ========================================
    // SAVE AI MESSAGE
    // ========================================
await addMessage(
    business.id,
    platform,
    customerId,
    "assistant",
    reply
);


// ========================================
// COMPLETE CONVERSATION AFTER LEAD
// ========================================

if (
    shouldCompleteConversation
) {

    const completionResult =
        await completeConversation(
            business.id,
            platform,
            customerId
        );


    if (
        completionResult?.success
    ) {

        console.log(
            `🏁 Conversation ${completionResult.conversationId} completed after lead capture`
        );
    }
    else {

        console.warn(
            "⚠️ Conversation could not be completed:",
            completionResult
        );
    }
}


return reply;
}


// ========================================
// EXPORT
// ========================================

module.exports = {
    generateAIReply
};