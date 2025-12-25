import { extractExternalIdWithAI } from "./property_mapper.js"

/**
 * Test script for AI-powered external ID extraction
 * Run with: node src/jobs/helpers/test_ai_extraction.js
 */

async function testExtraction() {
    const sampleProperty = {
        title: "SE IZNAJMUVA TROSOBEN STAN VO CENTAR,DEBAR MAALO",
        description:
            'ШИФРА- 3518„ДЕЛТА" Агенција за недвижности изнајмува наместен трособен стан во Центар, кај Fitnes House. Станот е комплетно наместен со нов мебел и бела техника.- 62м2- 2 спални- бања- дневна+кујна+трпезарија- тераса- 5/6 спрат- лифт- централно греење- паркинг место на ПОЦцена: 550еур. + режиски трошоци☎ 071 343 221071 343 224075 445 667✉ deltanedviznosti1@gmail.com',
    }

    console.log("Testing AI extraction with sample property data...")
    console.log("=" + "=".repeat(50))

    const externalId = await extractExternalIdWithAI(sampleProperty)

    console.log("=" + "=".repeat(50))
    console.log(`\nResult: ${externalId}`)
    console.log(`Type: ${typeof externalId}`)

    if (externalId === "3518") {
        console.log("✅ SUCCESS: Correctly extracted external ID!")
    } else {
        console.log(`⚠️  Expected "3518", got "${externalId}"`)
    }
}

testExtraction().catch(console.error)
