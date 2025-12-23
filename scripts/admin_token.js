import "dotenv/config"
import jwt from "jsonwebtoken"

const generateAdminToken = () => {
    const payload = {
        sub: "admin-user-id",
        role: "service_role",
        aud: "authenticated",
        iss: `${process.env.SUPABASE_URL}/auth/v1`,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    }

    return jwt.sign(payload, process.env.SUPABASE_JWT_SECRET, { algorithm: "HS256" })
}

const token = generateAdminToken()
console.log("Admin Token:", token)
