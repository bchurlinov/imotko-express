import { runPropertyAiPostprocess } from "#shared/ai/property_postprocess.js"

const logFailure = error => console.error("[AI_PROPERTY_POSTPROCESS] scheduling failed", error)

// The web runs this in after(); here it runs on the next tick, after the response is sent (design D §5). The copied
// runPropertyAiPostprocess logs its own errors and skips the write when the listing changed meanwhile.
export const scheduleAiPostprocess = (args, { run = runPropertyAiPostprocess, defer = setImmediate } = {}) => {
    defer(() => {
        try {
            Promise.resolve(run(args)).catch(logFailure)
        } catch (error) {
            logFailure(error)
        }
    })
}
