const OpenAI = require("openai");
const {
    saveLeadTool
} = require("../tools/leadTools");

const {
    getConversation,
    addMessage
} = require("./conversationService");

const {
    executeBusinessTool
} = require("./toolService");

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});


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
- When a business tool returns found=true, use the exact information returned by the tool.

- Never change, estimate, round, or invent a price.

- If duration is provided, tell the customer the duration when relevant.

- If warranty is provided, tell the customer the warranty when relevant.

- If free=true, clearly tell the customer the service is free.

-If found=false, never guess the price or service information.
- Tell the customer that the information is currently unavailable
and offer assistance from a team member.
- Customers may use abbreviations or incomplete device names.

- Use business tools to resolve device and service information.

- If a tool returns reason="ambiguous_device", do not choose a device yourself.
- Ask the customer a short follow-up question to identify the exact model.

- If a tool returns candidates, use those candidates to help clarify the model.

- Never invent a device match.
- Facebook Messenger does not support Markdown formatting.
- Never use Markdown, asterisks, headings, tables, or other formatting syntax.
- Write clean plain-text messages suitable for Messenger.
- Keep replies short, friendly, and conversational.
LEAD CAPTURE:

Your goal is to help genuine customers move toward completing
their purchase, booking, visit, or service request.

When a customer shows clear intent to proceed, such as:
- "I want to do it"
- "Can I come today?"
- "I want to book"
- "Where can I bring it?"
- "Can someone contact me?"
- similar buying intent

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
device, service, quoted_price, and intent.

Never invent customer information.

After save_lead succeeds, confirm naturally that the customer's
information has been received.

Do not tell the customer about databases, functions, tools,
metadata, or internal systems.

Facebook Messenger does not support Markdown formatting.
Do not use Markdown or asterisks.
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
    // FIRST AI CALL
    // ========================================

    const messages = [
        {
            role: "system",
            content: systemPrompt
        },
        ...history
    ];


    let response =
        await openai.chat.completions.create({

            model:
                process.env.OPENAI_MESSAGING_MODEL ||
                "gpt-5.6-terra",

            reasoning_effort: "none",

            messages,

            tools,

            tool_choice: "auto"
        });


    let assistantMessage =
        response.choices[0].message;


    // ========================================
    // TOOL CALLS
    // ========================================

    if (
        assistantMessage.tool_calls &&
        assistantMessage.tool_calls.length > 0
    ) {

        console.log(
            `🔧 AI requested ${assistantMessage.tool_calls.length} tool call(s)`
        );


        // Important:
        // the assistant tool-call message must be
        // included before tool results.
        messages.push(assistantMessage);


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
                "🔧 Executing business tool:",
                toolName,
                args
            );


            let result;


            if (toolName === "save_lead") {

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

            }
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


            messages.push({
                role: "tool",

                tool_call_id:
                    toolCall.id,

                content:
                    JSON.stringify(result)
            });
        }


        // ========================================
        // SECOND AI CALL
        // AI reads tool results and replies
        // ========================================

        response =
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
    }


    // ========================================
    // FINAL TEXT RESPONSE
    // ========================================

    const reply =
        assistantMessage.content?.trim();


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


    return reply;
}


module.exports = {
    generateAIReply
};