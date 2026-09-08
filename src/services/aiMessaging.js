const OpenAI = require("openai");

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
`;


    // ========================================
    // AVAILABLE TOOLS
    // ========================================

    const tools = [];


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


            const result =
                await executeBusinessTool({
                    businessId:
                        business.id,

                    toolName,

                    arguments:
                        args
                });


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