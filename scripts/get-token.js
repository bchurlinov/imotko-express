const SUPABASE_URL = "https://oemjvahdgigmzhfklwxu.supabase.co"
const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lbWp2YWhkZ2lnbXpoZmtsd3h1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwNjkzMTUsImV4cCI6MjA1ODY0NTMxNX0.PSdh4YQrRANScphMZnBXBS5r2S3FN9Nh9mat94IN9X4"
const EMAIL = "bchurlinov@hotmail.com"
const PASSWORD = "test123"

async function getToken() {
    try {
        const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
            method: "POST",
            headers: {
                apikey: SUPABASE_ANON_KEY,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                email: EMAIL,
                password: PASSWORD,
            }),
        })

        const data = await response.json()

        if (data.access_token) {
            console.log("\n✅ Access Token:\n")
            console.log(data.access_token)
            console.log("\n📋 Copy and use in Postman:\n")
            console.log(`Bearer ${data.access_token}`)
            console.log(`\n⏰ Expires in: ${data.expires_in} seconds\n`)
        } else {
            console.error("❌ Error:", data)
        }
    } catch (error) {
        console.error("❌ Failed to get token:", error)
    }
}

getToken()
