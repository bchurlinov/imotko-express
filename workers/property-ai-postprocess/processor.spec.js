import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { createPropertyAiProcessor } from "./processor.js"

const BASELINE = 1000
const NEWER = 2000

const makeJob = (data = {}, attemptsMade = 0, name = "process") => ({
    id: `property-ai-p1-${BASELINE}`,
    name,
    attemptsMade,
    opts: { attempts: 5 },
    data: { propertyId: "p1", baselineUpdatedAt: BASELINE, orderPhotos: true, ...data },
})

const makeStored = (overrides = {}) => ({
    id: "p1",
    agencyId: "a1",
    clientId: null,
    status: "PENDING",
    slug: "old-slug",
    updatedAt: new Date(BASELINE),
    photos: [{ id: "x" }, { id: "y" }],
    ...overrides,
})

const textPatch = (overrides = {}) => ({ name: { mk: "AI" }, slug: "old-slug", aiStatus: "DONE", ...overrides })

// Records every call in order; each dependency can be overridden per test.
const setup = (overrides = {}) => {
    const calls = []
    const record = name => (...args) => {
        calls.push({ name, args })
    }
    const logs = []
    const logger = {
        info: (event, fields) => logs.push({ level: "info", event, fields }),
        error: (event, fields) => logs.push({ level: "error", event, fields }),
    }
    const deps = {
        loadProperty: async id => {
            calls.push({ name: "loadProperty", args: [id] })
            return makeStored()
        },
        enrichStored: async (...args) => {
            calls.push({ name: "enrichStored", args })
            return textPatch()
        },
        orderPhotos: async (...args) => {
            calls.push({ name: "orderPhotos", args })
            return null
        },
        writeIfUnchanged: async (...args) => {
            calls.push({ name: "writeIfUnchanged", args })
            return true
        },
        toFailurePatch: property => ({ aiStatus: "FAILED", failedFor: property.id }),
        revalidate: async (...args) => {
            record("revalidate")(...args)
        },
        notifyTemplates: async (...args) => {
            record("notifyTemplates")(...args)
        },
        enqueueFacebook: async (...args) => {
            record("enqueueFacebook")(...args)
        },
        logger,
        ...overrides,
    }
    const processor = createPropertyAiProcessor(deps)
    const named = name => calls.filter(call => call.name === name)
    return { processor, calls, named, logs }
}

describe("createPropertyAiProcessor", () => {
    describe("skips", () => {
        test("stale: no LLM, no write, Facebook still queued", async () => {
            const { processor, named, calls } = setup({
                loadProperty: async () => makeStored({ updatedAt: new Date(NEWER) }),
            })
            await processor(makeJob({ facebookRevision: 9 }))

            assert.equal(named("enrichStored").length, 0)
            assert.equal(named("orderPhotos").length, 0)
            assert.equal(named("writeIfUnchanged").length, 0)
            assert.equal(named("revalidate").length, 0)
            assert.equal(named("notifyTemplates").length, 0)
            assert.deepEqual(named("enqueueFacebook").map(call => call.args), [
                [{ propertyId: "p1", agencyId: "a1", revision: 9 }],
            ])
            assert.equal(calls.at(-1).name, "enqueueFacebook")
        })

        test("stale without a facebookRevision: nothing is queued", async () => {
            const { processor, named } = setup({
                loadProperty: async () => makeStored({ updatedAt: new Date(NEWER) }),
            })
            await processor(makeJob())
            assert.equal(named("enrichStored").length, 0)
            assert.equal(named("enqueueFacebook").length, 0)
        })

        test("missing row: nothing happens", async () => {
            const { processor, calls } = setup({ loadProperty: async () => null })
            await processor(makeJob({ facebookRevision: 9 }))
            assert.deepEqual(calls.map(call => call.name), [])
        })

        test("DELETED: no LLM, no write, no Facebook", async () => {
            const { processor, named } = setup({
                loadProperty: async () => makeStored({ status: "DELETED" }),
            })
            await processor(makeJob({ facebookRevision: 9 }))

            assert.equal(named("enrichStored").length, 0)
            assert.equal(named("orderPhotos").length, 0)
            assert.equal(named("writeIfUnchanged").length, 0)
            assert.equal(named("revalidate").length, 0)
            assert.equal(named("notifyTemplates").length, 0)
            assert.equal(named("enqueueFacebook").length, 0)
        })

        test("DELETED is also skipped when the row is stale", async () => {
            const { processor, named } = setup({
                loadProperty: async () => makeStored({ status: "DELETED", updatedAt: new Date(NEWER) }),
            })
            await processor(makeJob({ facebookRevision: 9 }))
            assert.equal(named("enqueueFacebook").length, 0)
        })
    })

    describe("success", () => {
        test("one write, then revalidate, notify, Facebook, in that order", async () => {
            const { processor, calls, named } = setup()
            await processor(makeJob({ facebookRevision: 9 }))

            assert.deepEqual(
                calls.map(call => call.name),
                [
                    "loadProperty",
                    "enrichStored",
                    "orderPhotos",
                    "writeIfUnchanged",
                    "revalidate",
                    "notifyTemplates",
                    "enqueueFacebook",
                ]
            )
            assert.deepEqual(named("loadProperty")[0].args, ["p1"])
            assert.deepEqual(named("notifyTemplates")[0].args, [{ agencyId: "a1", propertyId: "p1" }])
            assert.deepEqual(named("enqueueFacebook")[0].args, [{ propertyId: "p1", agencyId: "a1", revision: 9 }])
        })

        test("the guarded write gets the baseline as a Date and the text patch", async () => {
            const { processor, named } = setup()
            await processor(makeJob())

            const [propertyId, baseline, patch] = named("writeIfUnchanged")[0].args
            assert.equal(propertyId, "p1")
            assert.ok(baseline instanceof Date)
            assert.equal(baseline.getTime(), BASELINE)
            assert.deepEqual(patch, textPatch())
        })

        test("the text step and the photo step both get the stored row and the AI context", async () => {
            const stored = makeStored()
            const { processor, named } = setup({ loadProperty: async () => stored })
            await processor(makeJob({ userId: "u1", orderPhotos: true }))

            const aiContext = { sessionId: "property-p1", distinctId: "u1" }
            assert.deepEqual(named("enrichStored")[0].args, [stored, aiContext])
            assert.deepEqual(named("orderPhotos")[0].args, [stored, { orderPhotos: true, aiContext }])
        })

        test("distinctId falls back to system without a userId", async () => {
            const { processor, named } = setup()
            await processor(makeJob())
            assert.equal(named("enrichStored")[0].args[1].distinctId, "system")
        })

        test("the patch gets photos only when orderPhotos returned an array", async () => {
            const reordered = [{ id: "y" }, { id: "x" }]
            const { processor, named } = setup({ orderPhotos: async () => reordered })
            await processor(makeJob())
            assert.deepEqual(named("writeIfUnchanged")[0].args[2], { ...textPatch(), photos: reordered })
        })

        test("an empty array from orderPhotos is still written", async () => {
            const { processor, named } = setup({ orderPhotos: async () => [] })
            await processor(makeJob())
            assert.deepEqual(named("writeIfUnchanged")[0].args[2].photos, [])
        })

        test("orderPhotos returning null leaves photos out of the patch", async () => {
            const { processor, named } = setup({ orderPhotos: async () => null })
            await processor(makeJob())
            assert.ok(!Object.hasOwn(named("writeIfUnchanged")[0].args[2], "photos"))
        })

        test("orderPhotos false is passed through", async () => {
            const { processor, named } = setup()
            await processor(makeJob({ orderPhotos: false }))
            assert.equal(named("orderPhotos")[0].args[1].orderPhotos, false)
        })

        test("both steps run concurrently", async () => {
            const started = []
            let release
            const gate = new Promise(resolve => {
                release = resolve
            })
            const { processor } = setup({
                enrichStored: async () => {
                    started.push("text")
                    await gate
                    return textPatch()
                },
                orderPhotos: async () => {
                    started.push("photos")
                    release()
                    return null
                },
            })
            await processor(makeJob())
            assert.deepEqual(started, ["text", "photos"])
        })

        test("no facebookRevision: Facebook is not queued", async () => {
            const { processor, named } = setup()
            await processor(makeJob())
            assert.equal(named("enqueueFacebook").length, 0)
            assert.equal(named("revalidate").length, 1)
        })

        test("a slug change sends the previous slug to revalidate", async () => {
            const { processor, named } = setup({
                enrichStored: async () => textPatch({ slug: "new-slug" }),
            })
            await processor(makeJob())
            assert.deepEqual(named("revalidate")[0].args, [{ propertyId: "p1", previousSlug: "old-slug" }])
        })

        test("an unchanged slug sends no previous slug", async () => {
            const { processor, named } = setup()
            await processor(makeJob())
            assert.deepEqual(named("revalidate")[0].args, [{ propertyId: "p1", previousSlug: undefined }])
        })

        test("any job name other than sweep is processed", async () => {
            const { processor, named } = setup()
            await processor(makeJob({}, 0, "property-ai-postprocess"))
            assert.equal(named("writeIfUnchanged").length, 1)
        })
    })

    describe("guard lost", () => {
        test("no revalidate, no notify, Facebook still queued", async () => {
            const { processor, named } = setup({
                writeIfUnchanged: async () => false,
            })
            await processor(makeJob({ facebookRevision: 9 }))

            assert.equal(named("revalidate").length, 0)
            assert.equal(named("notifyTemplates").length, 0)
            assert.deepEqual(named("enqueueFacebook")[0].args, [{ propertyId: "p1", agencyId: "a1", revision: 9 }])
        })
    })

    describe("text failure", () => {
        const failing = () => {
            const error = new Error("provider exploded")
            error.name = "APICallError"
            return error
        }

        test("before the last attempt it rethrows with no failure patch and no Facebook", async () => {
            const error = failing()
            const { processor, named } = setup({
                enrichStored: async () => {
                    throw error
                },
            })
            await assert.rejects(processor(makeJob({ facebookRevision: 9 }, 3)), err => err === error)

            assert.equal(named("writeIfUnchanged").length, 0)
            assert.equal(named("revalidate").length, 0)
            assert.equal(named("notifyTemplates").length, 0)
            assert.equal(named("enqueueFacebook").length, 0)
        })

        test("on the last attempt it writes the failure patch, revalidates, notifies, queues Facebook, then rethrows", async () => {
            const error = failing()
            const { processor, calls, named } = setup({
                enrichStored: async () => {
                    throw error
                },
            })
            await assert.rejects(processor(makeJob({ facebookRevision: 9 }, 4)), err => err === error)

            const writes = named("writeIfUnchanged")
            assert.equal(writes.length, 1)
            const [propertyId, baseline, patch] = writes[0].args
            assert.equal(propertyId, "p1")
            assert.equal(baseline.getTime(), BASELINE)
            assert.deepEqual(patch, { aiStatus: "FAILED", failedFor: "p1" })
            assert.deepEqual(named("enqueueFacebook")[0].args, [{ propertyId: "p1", agencyId: "a1", revision: 9 }])
            assert.ok(
                calls.findIndex(call => call.name === "writeIfUnchanged") <
                    calls.findIndex(call => call.name === "enqueueFacebook")
            )
            assert.deepEqual(named("revalidate").map(call => call.args), [[{ propertyId: "p1" }]])
            assert.deepEqual(named("notifyTemplates").map(call => call.args), [[{ agencyId: "a1", propertyId: "p1" }]])
            assert.deepEqual(
                calls.map(call => call.name).filter(name => name !== "loadProperty"),
                ["orderPhotos", "writeIfUnchanged", "revalidate", "notifyTemplates", "enqueueFacebook"]
            )
        })

        test("on the last attempt without a facebookRevision only the failure patch is written", async () => {
            const { processor, named } = setup({
                enrichStored: async () => {
                    throw failing()
                },
            })
            await assert.rejects(processor(makeJob({}, 4)))
            assert.equal(named("writeIfUnchanged").length, 1)
            assert.equal(named("enqueueFacebook").length, 0)
        })

        test("a failure patch that loses the guard still queues Facebook and rethrows the text error", async () => {
            const error = failing()
            const { processor, named } = setup({
                enrichStored: async () => {
                    throw error
                },
                writeIfUnchanged: async () => false,
            })
            await assert.rejects(processor(makeJob({ facebookRevision: 9 }, 4)), err => err === error)
            assert.equal(named("enqueueFacebook").length, 1)
            assert.equal(named("revalidate").length, 0)
            assert.equal(named("notifyTemplates").length, 0)
        })

        test("a throwing notifyTemplates after the failure write still queues Facebook and rethrows the text error", async () => {
            const error = failing()
            const { processor, named, logs } = setup({
                enrichStored: async () => {
                    throw error
                },
                notifyTemplates: async () => {
                    throw Object.assign(new Error("SECRET-NOTIFY-MESSAGE"), { name: "NotifyError" })
                },
            })
            await assert.rejects(processor(makeJob({ facebookRevision: 9 }, 4)), err => err === error)
            assert.equal(named("enqueueFacebook").length, 1)
            assert.ok(!JSON.stringify(logs).includes("SECRET-NOTIFY-MESSAGE"))
            assert.ok(logs.some(entry => entry.level === "error" && entry.fields.errorCode === "NotifyError"))
        })

        test("a failing failure-patch write or Facebook enqueue never hides the original error", async () => {
            const error = failing()
            const { processor, named } = setup({
                enrichStored: async () => {
                    throw error
                },
                writeIfUnchanged: async () => {
                    throw new Error("db down")
                },
                enqueueFacebook: async () => {
                    throw new Error("redis down")
                },
            })
            await assert.rejects(processor(makeJob({ facebookRevision: 9 }, 4)), err => err === error)
            assert.equal(named("revalidate").length, 0)
        })

        test("the photo step is not written when the text step failed", async () => {
            const { processor, named } = setup({
                enrichStored: async () => {
                    throw failing()
                },
                orderPhotos: async () => [{ id: "y" }],
            })
            await assert.rejects(processor(makeJob({}, 4)))
            assert.deepEqual(named("writeIfUnchanged")[0].args[2], { aiStatus: "FAILED", failedFor: "p1" })
        })
    })

    describe("Facebook enqueue failure", () => {
        test("rethrows; the retry skips as stale and queues Facebook without another LLM call", async () => {
            let stored = makeStored()
            let enqueueFails = true
            const counts = { enrich: 0, enqueue: 0 }
            const { processor } = setup({
                loadProperty: async () => stored,
                enrichStored: async () => {
                    counts.enrich += 1
                    return textPatch()
                },
                writeIfUnchanged: async () => {
                    // The write bumps updatedAt, exactly like the real guarded update
                    stored = makeStored({ updatedAt: new Date(NEWER) })
                    return true
                },
                enqueueFacebook: async () => {
                    counts.enqueue += 1
                    if (enqueueFails) throw new Error("redis down")
                },
            })

            await assert.rejects(processor(makeJob({ facebookRevision: 9 })), /redis down/)
            assert.equal(counts.enrich, 1)
            assert.equal(counts.enqueue, 1)

            enqueueFails = false
            await processor(makeJob({ facebookRevision: 9 }, 1))
            assert.equal(counts.enrich, 1)
            assert.equal(counts.enqueue, 2)
        })
    })

    describe("logging", () => {
        test("logs ids, job id and attempt only, never error text, request bodies or listing content", async () => {
            const error = Object.assign(new Error("SECRET-MESSAGE listing text"), {
                name: "APICallError",
                statusCode: 429,
                requestBodyValues: { input: "SECRET-TEXT" },
                url: "https://api.openai.com/v1/secret-url",
            })
            const stored = makeStored({
                name: { mk: "SECRET-TITLE" },
                photos: [{ sizes: { medium: "https://cdn/SECRET-PHOTO.webp" } }],
            })
            const { processor, logs } = setup({
                loadProperty: async () => stored,
                enrichStored: async () => {
                    throw error
                },
                writeIfUnchanged: async () => {
                    throw error
                },
                enqueueFacebook: async () => {
                    throw error
                },
            })

            await assert.rejects(processor(makeJob({ facebookRevision: 9 }, 4)), err => err === error)

            const serialized = JSON.stringify(logs)
            for (const secret of ["SECRET-TEXT", "SECRET-MESSAGE", "SECRET-TITLE", "SECRET-PHOTO", "secret-url"]) {
                assert.ok(!serialized.includes(secret), `${secret} leaked into the logs`)
            }
            const started = logs.find(entry => entry.event === "property_ai_job_started")
            assert.deepEqual(started.fields, {
                jobId: `property-ai-p1-${BASELINE}`,
                jobName: "process",
                propertyId: "p1",
                attempt: 5,
            })
            // The two swallowed last-attempt failures are logged by name only
            const swallowed = logs.filter(entry => entry.level === "error")
            assert.deepEqual(
                swallowed.map(entry => [entry.event, entry.fields]),
                [
                    ["property_ai_failure_write_failed", { propertyId: "p1", errorCode: "APICallError" }],
                    ["property_ai_facebook_enqueue_failed", { propertyId: "p1", errorCode: "APICallError" }],
                ]
            )
        })

        test("a throwing logger never fails the job", async () => {
            const logger = {
                info: () => {
                    throw new Error("log down")
                },
                error: () => {
                    throw new Error("log down")
                },
            }
            const { processor, named } = setup({ logger })
            await processor(makeJob())
            assert.equal(named("writeIfUnchanged").length, 1)
        })
    })
})
